// Placeholder type definitions for expo-apple-authentication
// These are empty types since we're removing the actual implementation

declare module 'expo-apple-authentication' {
    export const AppleAuthenticationButtonType: {
        readonly SIGN_IN: 0;
        readonly CONTINUE: 1;
        readonly SIGN_UP: 2;
    };

    export const AppleAuthenticationButtonStyle: {
        readonly WHITE: 0;
        readonly WHITE_OUTLINE: 1;
        readonly BLACK: 2;
    };

    export const AppleAuthenticationScope: {
        readonly FULL_NAME: 0;
        readonly EMAIL: 1;
    };

    export function isAvailableAsync(): Promise<boolean>;

    export function signInAsync(options: any): Promise<any>;

    export function AppleAuthenticationButton(props: any): JSX.Element;
} 