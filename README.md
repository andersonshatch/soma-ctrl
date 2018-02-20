# SOMA Blind Controller Util
Util for controlling SOMA smart shade

# Requirements
- SOMA smart shade device
- Bluetooth 4.0 LE hardware
- OS supported by [noble](https://github.com/noble/noble) (I've only tested on macOS)
- Node (at a guess... some recent version, I'm testing with 9.3.0 installed)

# Installation
Clone and then run `npm install`

# Usage

First determine name of your smart shade device, it should be RISE followed by 3 digits, e.g. RISE101 and supply it as the first argument
(Discovering compatibile devices is still a TODO)

## Determine blind position:
`node index.js RISEnnn`

Output will be a number between 0 (fully closed) and 100 (fully open)

## Determine battery percent of smart shade device:
`node index.js RISEnnn batt`

Output will be between 0 and 100 (at least in theory, readings seem inaccurate)

## Set blind position:
`node index.js RISEnnn <position>`

Where \<position\> is between 0 (fully closed) and 100 (fully open)


# Configuration

If a device by the name provided as the first argument is not found within a certain time, the progam will quit with exit code 1 and write `timeout of 15 seconds reached (adjustable by TIMEOUT_SECS envvar)` to stderr

Use the `TIMEOUT_SECS` environment variable to control the timeout, default is 15
