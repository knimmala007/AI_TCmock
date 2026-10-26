// GET /api/health: alive, Node version, and the rules and fixtures counts. No session, storage or secret.
import { createHealthHandler } from '../backend/health.js';

const handler = createHealthHandler();
// Every method maps to the handler so anything but GET gets its 405.
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
