const std = @import("std");
const redstone_wire = @import("components/redstone_wire.zig");

// ================== Basic Type Definitions ==================
pub const Coord = struct { x: i32, y: i32, z: i32 };

pub const Powered = enum(u8) {
    none = 0,
    weak = 1,
    strong = 2,
};

pub const BlockState = packed struct {
    type: u8, // bits 0-7
    signal: u4, // bits 8-11 (0-15)
    connections: u4, // bits 12-15 (E/S/W/N)
    powered: u2, // bits 16-17
    delay: u8, // bits 18-25
    _reserved: u6, // bits 26-31
};

// ================== Global State ==================
var allocator: std.mem.Allocator = undefined;
var world_blocks: std.AutoHashMap(Coord, BlockState) = undefined;
var is_initialized: bool = false;
var current_tick: u64 = 0;

// Queue type definitions
const wa = std.heap.wasm_allocator;
const CoordArrayList = std.ArrayList(Coord);
const DelayedTask = struct { coord: Coord, execute_tick: u64 };
const DelayedArrayList = std.ArrayList(DelayedTask);

// Queue instances
var immediate_queue = CoordArrayList.empty;
var delayed_queue: DelayedArrayList = DelayedArrayList.empty;

const FirstOrderNeibors = [6]Coord{
    .{ .x = 1, .y = 0, .z = 0 },
    .{ .x = -1, .y = 0, .z = 0 },
    .{ .x = 0, .y = 0, .z = 1 },
    .{ .x = 0, .y = 0, .z = -1 },
    .{ .x = 0, .y = 1, .z = 0 },
    .{ .x = 0, .y = -1, .z = 0 },
};
const RedstoneConnections = [12]Coord{
    .{ .x = 1, .y = 0, .z = 0 },
    .{ .x = -1, .y = 0, .z = 0 },
    .{ .x = 0, .y = 0, .z = 1 },
    .{ .x = 0, .y = 0, .z = -1 },
    .{ .x = 1, .y = 1, .z = 0 },
    .{ .x = -1, .y = 1, .z = 0 },
    .{ .x = 0, .y = 1, .z = 1 },
    .{ .x = 0, .y = 1, .z = -1 },
    .{ .x = 1, .y = -1, .z = 0 },
    .{ .x = -1, .y = -1, .z = 0 },
    .{ .x = 0, .y = -1, .z = 1 },
    .{ .x = 0, .y = -1, .z = -1 },
};
const SecondOrderNeibors = [18]Coord{
    .{ .x = 2, .y = 0, .z = 0 },
    .{ .x = -2, .y = 0, .z = 0 },
    .{ .x = 0, .y = 0, .z = 2 },
    .{ .x = 0, .y = 0, .z = -2 },
    .{ .x = 0, .y = 2, .z = 0 },
    .{ .x = 0, .y = -2, .z = 0 },
    .{ .x = 1, .y = 0, .z = 1 },
    .{ .x = -1, .y = 0, .z = 1 },
    .{ .x = 1, .y = 0, .z = -1 },
    .{ .x = -1, .y = 0, .z = -1 },
    .{ .x = 0, .y = 1, .z = 1 },
    .{ .x = 0, .y = 1, .z = -1 },
    .{ .x = 0, .y = -1, .z = 1 },
    .{ .x = 0, .y = -1, .z = -1 },
    .{ .x = 1, .y = 1, .z = 0 },
    .{ .x = 1, .y = -1, .z = 0 },
    .{ .x = -1, .y = 1, .z = 0 },
    .{ .x = -1, .y = -1, .z = 0 },
};
// ================== Helper Functions ==================
pub fn getBlock(x: i32, y: i32, z: i32) ?BlockState {
    return world_blocks.get(.{ .x = x, .y = y, .z = z });
}

pub fn updateBlock(x: i32, y: i32, z: i32, new_state: BlockState) void {
    world_blocks.put(.{ .x = x, .y = y, .z = z }, new_state) catch unreachable;
}

pub fn addTask(x: i32, y: i32, z: i32) void {
    immediate_queue.append(wa, .{ .x = x, .y = y, .z = z }) catch {};
}

pub fn addDelayedTask(x: i32, y: i32, z: i32, delay_ticks: u8) void {
    delayed_queue.append(wa, .{ .coord = .{ .x = x, .y = y, .z = z }, .execute_tick = current_tick + @as(u64, delay_ticks) }) catch {};
}

// Connectable block types (for redstone dust connections)
var connectable_blocks: [1]u8 = .{2}; // Redstone dust

pub fn isConnectableBlock(block_type: u8) bool {
    for (connectable_blocks) |bt| {
        if (bt == block_type) return true;
    }
    return false;
}

// Check if a neighbor block can provide signal to redstone dust
// TODO: Implement full powering logic (strong power, weak power, etc.)
pub fn canProvideSignal(nb: BlockState) bool {
    return nb.type == 2 and nb.signal > 0; // Redstone dust with signal
}

pub fn updateConnections(x: i32, y: i32, z: i32) void {
    const block = getBlock(x, y, z) orelse return;
    if (block.type != 2) return; // Only redstone dust

    var connections: u4 = 0;

    const directions = [_]Coord{
        .{ .x = 1, .y = 0, .z = 0 }, // East
        .{ .x = 0, .y = 0, .z = 1 }, // South
        .{ .x = -1, .y = 0, .z = 0 }, // West
        .{ .x = 0, .y = 0, .z = -1 }, // North
    };

    for (directions, 0..) |dir, idx| {
        const di: u2 = @intCast(idx);

        // Check same level
        if (getBlock(x + dir.x, y, z + dir.z)) |nb| {
            if (isConnectableBlock(nb.type)) {
                connections |= @as(u4, 1) << di;
                continue;
            }
        }

        // Check y+1 level
        if (getBlock(x + dir.x, y + 1, z + dir.z)) |nb| {
            if (isConnectableBlock(nb.type)) {
                connections |= @as(u4, 1) << di;
                continue;
            }
        }

        // Check y-1 level
        if (getBlock(x + dir.x, y - 1, z + dir.z)) |nb| {
            if (isConnectableBlock(nb.type)) {
                connections |= @as(u4, 1) << di;
                continue;
            }
        }
    }

    if (connections != block.connections) {
        var new_block = block;
        new_block.connections = connections;
        updateBlock(x, y, z, new_block);
    }
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

// Update second-order neighbor redstone signal
// TODO: Implement actual signal propagation logic
pub fn updateSecondOrderRedstone(x: i32, y: i32, z: i32) void {
    // TODO: Implement signal recalculation for second-order redstone
    for (FirstOrderNeibors) |dCoord| {
        _ = getBlock(x + dCoord.x, y + dCoord.y, z + dCoord.z); // Placeholder
    }
    for (SecondOrderNeibors) |dCoord| {
        _ = getBlock(x + dCoord.x, y + dCoord.y, z + dCoord.z); // Placeholder
    }
}

export fn setBlockSignal(x: i32, y: i32, z: i32, signal: u8) void {
    if (world_blocks.getPtr(.{ .x = x, .y = y, .z = z })) |block| {
        block.signal = @as(u4, @intCast(signal));
        addTask(x, y, z); // Signal change triggers update
    }
}
export fn placeBlock(x: i32, y: i32, z: i32, blockId: u8) void {
    world_blocks.put(
        .{ .x = x, .y = y, .z = z },
        .{
            .type = blockId,
            .signal = 0,
            .connections = 0,
            .powered = 0, // .none = 0
            .delay = 0,
            ._reserved = 0,
        },
    ) catch unreachable;

    addTask(x, y, z);
    if (blockId == 2) {
        updateConnections(x, y, z);

        // Also update connections of neighbors at multiple heights (first-order neighbors)
        for (RedstoneConnections) |dCoord| {
            updateConnections(x + dCoord.x, y + dCoord.y, z + dCoord.z);
        }
    }

    // Trigger second-order redstone signal update
    // (Find redstone dust that is 2 blocks away from the placed block)
    updateSecondOrderRedstone(x, y, z);
}
export fn removeBlock(x: i32, y: i32, z: i32) void {
    _ = world_blocks.remove(.{ .x = x, .y = y, .z = z });

    addTask(x, y, z);
    // Also update connections of neighbors at multiple heights (first-order neighbors)
    for (RedstoneConnections) |dCoord| {
        updateConnections(x + dCoord.x, y + dCoord.y, z + dCoord.z);
    }

    // Trigger second-order redstone signal update
    // (Find redstone dust that is 2 blocks away from the placed block)
    updateSecondOrderRedstone(x, y, z);
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

        if (block.type == 2) {
            redstone_wire.update(coord.x, coord.y, coord.z);
        }
    }
}

export fn getBlockState(x: i32, y: i32, z: i32) u32 {
    const res = getBlock(x, y, z) orelse return 0;

    const poweredBit: u32 = switch (@as(Powered, @enumFromInt(res.powered))) {
        .none => 0,
        .weak => 1,
        .strong => 2,
    };

    return (@as(u32, res.type) << 24) |
        (@as(u32, res.signal) << 20) |
        (@as(u32, res.connections) << 16) |
        (poweredBit << 14) |
        (@as(u32, res.delay) << 6);
}

export fn _start() void {
    allocator = std.heap.wasm_allocator;
}
