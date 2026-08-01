const main = @import("../main.zig");

pub fn update(x: i32, y: i32, z: i32) void {
    const block = main.getBlock(x, y, z) orelse return;

    if (block.type != 2) return; // Only redstone dust

    // Calculate new signal strength based on connections
    var max_signal: u4 = 0;

    // Direction offsets: East, South, West, North
    const directions = [_]main.Coord{
        .{ .x = 1, .y = 0, .z = 0 }, // East (bit 0)
        .{ .x = 0, .y = 0, .z = 1 }, // South (bit 1)
        .{ .x = -1, .y = 0, .z = 0 }, // West (bit 2)
        .{ .x = 0, .y = 0, .z = -1 }, // North (bit 3)
    };

    // Check only connected directions
    var dir_idx: u4 = 0;
    while (dir_idx < 4) : (dir_idx += 1) {
        // Check if this direction is connected
        if ((block.connections & (@as(u4, 1) << @as(u2, @intCast(dir_idx)))) == 0) continue;

        const dir = directions[dir_idx];
        const nx = x + dir.x;
        const nz = z + dir.z;

        // Check 3 heights: same level, above, below
        const heights = [_]i32{ y, y + 1, y - 1 };
        for (heights) |check_y| {
            if (main.getBlock(nx, check_y, nz)) |nb| {
                if (main.canProvideSignal(nb)) {
                    max_signal = @max(max_signal, nb.signal -| 1);
                }
            }
        }
    }

    if (max_signal != block.signal) {
        var new_block = block;
        new_block.signal = @as(u4, @intCast(max_signal));
        main.updateBlock(x, y, z, new_block);

        // Notify connected neighbors to update
        dir_idx = 0;
        while (dir_idx < 4) : (dir_idx += 1) {
            const bit: u4 = @as(u4, 1) << @intCast(dir_idx);
            if ((block.connections & bit) == 0) continue;

            const dir = directions[dir_idx];
            const heights = [_]i32{ y, y + 1, y - 1 };
            for (heights) |check_y| {
                main.addTask(x + dir.x, check_y, z + dir.z);
            }
        }
    }
}
