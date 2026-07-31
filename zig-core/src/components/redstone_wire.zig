const std = @import("std");
const main = @import("../main.zig");

pub fn update(x: i32, y: i32, z: i32) void {
    const block = main.getBlock(x, y, z) orelse return;

    if (block.type != 1) return;

    // Calculate new signal strength
    var max_signal: u8 = 0;
    const neighbors = [_]main.Coord{
        .{ .x = x + 1, .y = y, .z = z },
        .{ .x = x - 1, .y = y, .z = z },
        .{ .x = x, .y = y + 1, .z = z },
        .{ .x = x, .y = y - 1, .z = z },
        .{ .x = x, .y = y, .z = z + 1 },
        .{ .x = x, .y = y, .z = z - 1 },
    };

    for (neighbors) |neighbor| {
        if (main.getBlock(neighbor.x, neighbor.y, neighbor.z)) |nb| {
            if (nb.signal > 0) {
                // Signal attenuation calculation
                max_signal = @max(max_signal, nb.signal -| 1); // >0
            }
        }
    }
    if (max_signal != block.signal) {
        var new_block = block;
        new_block.signal = max_signal;
        main.updateBlock(x, y, z, new_block);

        // Notify neighbors to update
        for (neighbors) |neighbor| {
            main.addTask(neighbor.x, neighbor.y, neighbor.z);
        }
    }
}
