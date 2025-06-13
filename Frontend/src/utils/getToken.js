/**
 * This utility was removed for security reasons.
 * Token logging can expose sensitive authentication data in production.
 */

console.warn('⚠️ Token logging utility has been disabled for security.');

export default () => {
    console.error('🚫 Token logging disabled for production security.');
    return null;
}; 