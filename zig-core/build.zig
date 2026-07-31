const std = @import("std");

pub fn build(b: *std.Build) void {
    // Get standard target options and optimize options
    const target = b.standardTargetOptions(.{
        .default_target = .{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
            .abi = .none,
        },
    });
    const optimize = b.standardOptimizeOption(.{});

    // Create root module
    const lib_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Use addExecutable to generate WASM
    // In Zig 0.13+, for wasm32-freestanding, addExecutable generates .wasm file
    const exe = b.addExecutable(.{
        .name = "redstone_core",
        .root_module = lib_mod,
    });
    // Add all symbols marked as export to Wasm's export table
    exe.rdynamic = true;
    // Install artifact to specified path
    // getEmittedBin() returns the generated .wasm file path
    const install_wasm = b.addInstallFile(
        exe.getEmittedBin(),
        "../../web-frontend/public/redstone_core.wasm",
    );

    // Make the default install step depend on this install action
    b.getInstallStep().dependOn(&install_wasm.step);
}
