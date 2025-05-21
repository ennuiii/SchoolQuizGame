# School Quiz Game Server

This is the server component of the School Quiz Game application.

## Server Implementation

The server has been implemented in two versions:
1. The original JavaScript version (`index.js`)
2. A TypeScript version (in the `src` directory)

Both versions maintain 100% client compatibility.

## Installation

```bash
# Install dependencies
npm install
```

## Running the Server

### Running the TypeScript Version

```bash
# First build the TypeScript code
npm run build

# Then run the compiled version
npm start
```

### Running the Original JavaScript Version

```bash
# Run the original JavaScript version directly
npm run start:js
```

## Development

For development, you can use the watch mode:

```bash
# For TypeScript version
npm run dev

# For JavaScript version
npm run dev:js
```

## Structure

- `/src` - TypeScript source code
  - `/src/services` - Service modules for room management, socket handling, etc.
  - `/src/types.ts` - TypeScript types and interfaces
  - `/src/index.ts` - Main entry point
- `/dist` - Compiled TypeScript code (created after running build)
- `index.js` - Original JavaScript implementation
- `index.js.bak` - Backup of the original JavaScript implementation

## Client Compatibility

Both server versions (JavaScript and TypeScript) maintain 100% compatibility with the existing client. The TypeScript implementation uses the same event names, data structures, and behavior patterns as the original JavaScript version. 