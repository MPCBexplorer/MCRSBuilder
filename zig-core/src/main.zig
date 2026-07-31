const std = @import("std");
const redstone_wire = @import("components/redstone_wire.zig");

// ================== Basic Type Definitions ==================
pub const Coord = struct { x: i32, y: i32, z: i32 };

pub const Powered = enum(u8) {
    none = 0,
    weak = 1,
    strong = 2,
};

pub const BlockState = struct { type: u8, signal: u8, powered: Powered, delay: u8 };

// ================== Global State ==================
var allocator: std.mem.Allocator = undefined;
var world_blocks: std.AutoHashMap(Coord, BlockState) = undefined;
var is_initialized: bool = false;
var current_tick: u64 = 0;

// Queue type definitions
const ba = std.heap.brk_allocator;
const CoordArrayList = std.ArrayList(Coord);
const DelayedTask = struct { coord: Coord, execute_tick: u64 };
const DelayedArrayList = std.ArrayList(DelayedTask);

// Queue instances
var immediate_queue = CoordArrayList.empty;
var delayed_queue: DelayedArrayList = DelayedArrayList.empty;

// ================== Helper Functions ==================
pub fn getBlock(x: i32, y: i32, z: i32) ?BlockState {
    return world_blocks.get(.{ .x = x, .y = y, .z = z });
}

pub fn updateBlock(x: i32, y: i32, z: i32, new_state: BlockState) void {
    world_blocks.put(.{ .x = x, .y = y, .z = z }, new_state) catch unreachable;
}

pub fn addTask(x: i32, y: i32, z: i32) void {
    immediate_queue.append(ba, .{ .x = x, .y = y, .z = z }) catch {};
}

pub fn addDelayedTask(x: i32, y: i32, z: i32, delay_ticks: u8) void {
    delayed_queue.append(ba, .{ .coord = .{ .x = x, .y = y, .z = z }, .execute_tick = current_tick + @as(u64, delay_ticks) }) catch {};
}

// ================== WASM Exported Functions ==================
export fn initWorld(width: i32, height: i32, depth: i32) void {
    _ = width;
    _ = height;
    _ = depth;

    if (!is_initialized) {
        allocator = std.heap.page_allocator;
        world_blocks = std.AutoHashMap(Coord, BlockState).init(allocator);

        is_initialized = true;
    } else {
        world_blocks.clearRetainingCapacity();
        immediate_queue.clearRetainingCapacity();
        delayed_queue.clearRetainingCapacity();
    }
    current_tick = 0;
}

export fn placeBlock(x: i32, y: i32, z: i32, blockId: u8) void {
    world_blocks.put(
        .{ .x = x, .y = y, .z = z },
        .{
            .type = blockId,
            .signal = 0,
            .powered = .none,
            .delay = 0,
        },
    ) catch unreachable;

    addTask(x, y, z); // Add to update queue immediately after placement
}

export fn setBlockSignal(x: i32, y: i32, z: i32, signal: u8) void {
    if (world_blocks.getPtr(.{ .x = x, .y = y, .z = z })) |block| {
        block.signal = signal;
        addTask(x, y, z); // Signal change triggers update
    }
}

export fn removeBlock(x: i32, y: i32, z: i32) void {
    _ = world_blocks.remove(.{ .x = x, .y = y, .z = z });

    // Notify neighbors to update
    const neighbors = [_]Coord{
        .{ .x = x + 1, .y = y, .z = z },
        .{ .x = x - 1, .y = y, .z = z },
        .{ .x = x, .y = y + 1, .z = z },
        .{ .x = x, .y = y - 1, .z = z },
        .{ .x = x, .y = y, .z = z + 1 },
        .{ .x = x, .y = y, .z = z - 1 },
    };

    for (neighbors) |neighbor| {
        addTask(neighbor.x, neighbor.y, neighbor.z);
    }
}

export fn tick() void {
    current_tick += 1;

    var i: usize = 0;
    while (i < delayed_queue.items.len) {
        const task = delayed_queue.items[i];
        if (current_tick >= task.execute_tick) {
            // Move expired tasks to immediate queue
            addTask(task.coord.x, task.coord.y, task.coord.z);
            // Remove from delayed queue
            _ = delayed_queue.swapRemove(i);
        } else {
            i += 1;
        }
    }

    // Process redstone wire updates
    var iteration_count: u32 = 0;
    const MAX_ITERATIONS = 1000;

    while (immediate_queue.items.len > 0 and iteration_count < MAX_ITERATIONS) {
        iteration_count += 1;
        const coord = immediate_queue.orderedRemove(0);

        const block = getBlock(coord.x, coord.y, coord.z) orelse continue;

        if (block.type == 1) {
            redstone_wire.update(coord.x, coord.y, coord.z);
        }
    }
}

export fn getBlockState(x: i32, y: i32, z: i32) u32 {
    const res = getBlock(x, y, z) orelse return 0;

    const poweredBit: u32 = switch (res.powered) {
        .none => 0,
        .weak => 1,
        .strong => 2,
    };

    return (@as(u32, res.type) << 24) |
        (@as(u32, res.signal) << 16) |
        (poweredBit << 8) |
        @as(u32, res.delay);
}

export fn _start() void {
    allocator = std.heap.page_allocator;
}
