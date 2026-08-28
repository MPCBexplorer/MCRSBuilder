const main = @import("../main.zig");

/// Update redstone torch state based on attached block power
pub fn update(x: i32, y: i32, z: i32) void {
    const block = main.getBlock(x, y, z) orelse return;

    if (block.type != 3) return; // Only redstone torch
    // Determine the attached block coordinates based on connections bitmask
    var attach_dx: i32 = 0;
    var attach_dy: i32 = 0;
    var attach_dz: i32 = 0;

    switch (block.connections) {
        0b0000 => {
            // Top placement - attached block is below
            attach_dy = -1;
        },
        0b0001 => {
            // North face - attached block is to the south
            attach_dz = 1;
        },
        0b0010 => {
            // West face - attached block is to the east
            attach_dx = 1;
        },
        0b0100 => {
            // South face - attached block is to the north
            attach_dz = -1;
        },
        0b1000 => {
            // East face - attached block is to the west
            attach_dx = -1;
        },
        else => return, // Invalid orientation
    }

    // Check if the attached block is powered
    const attached_block_x = x + attach_dx;
    const attached_block_y = y + attach_dy;
    const attached_block_z = z + attach_dz;

    var is_powered = main.Powered.none;
    if (main.getBlock(attached_block_x, attached_block_y, attached_block_z)) |attached| {
        is_powered = @enumFromInt(attached.powered);
    }

    // Calculate new signal: extinguished if powered, lit otherwise
    const new_signal: u4 = if (is_powered != main.Powered.none) 0 else 15;

    if (new_signal != block.signal) {
        var new_block = block;
        new_block.signal = new_signal;
        main.updateBlock(x, y, z, new_block);
        // TODO: Notify neighboring redstone components to update
        // Reserved: main.addTask(...) for neighbor notification
    }
}
