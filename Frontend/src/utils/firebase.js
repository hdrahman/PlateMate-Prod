/**
 * IMPORTANT: This file redirects to the proper Firebase initialization file.
 * 
 * This file is a compatibility layer to handle legacy imports. 
 * Future code should directly import from './firebase/index'
 */

// Re-export everything from the proper Firebase file
export * from './firebase/index';

// Throw a console warning for debugging
console.warn(
    'Warning: You are importing Firebase from utils/firebase instead of utils/firebase/index. ' +
    'This works but is deprecated. Update your imports to use utils/firebase/index directly.'
); 