#!/usr/bin/env node
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

const distDir = join(process.cwd(), '.next')

if (existsSync(distDir)) {
  try {
    rmSync(distDir, { recursive: true, force: true, maxRetries: 3 })
  } catch (error) {
    console.warn('[clean-next] Failed to remove .next directory before start:', error.message)
  }
}
