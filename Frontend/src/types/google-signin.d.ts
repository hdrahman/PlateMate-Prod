declare module '@react-native-google-signin/google-signin' {
    export interface GoogleSigninButtonProps {
        size?: number;
        color?: number;
        disabled?: boolean;
        onPress?(): void;
    }

    export class GoogleSigninButton extends React.Component<GoogleSigninButtonProps> { }

    export interface ConfigureParams {
        scopes?: string[];
        webClientId?: string;
        offlineAccess?: boolean;
        hostedDomain?: string;
        forceCodeForRefreshToken?: boolean;
        accountName?: string;
        googleServicePlistPath?: string;
        openIdRealm?: string;
        profileImageSize?: number;
    }

    export interface User {
        user: {
            id: string;
            name: string | null;
            email: string;
            photo: string | null;
            familyName: string | null;
            givenName: string | null;
        };
        scopes: string[];
        idToken: string | null;
        serverAuthCode: string | null;
    }

    export const GoogleSignin: {
        configure(params: ConfigureParams): void;
        hasPlayServices(options?: { showPlayServicesUpdateDialog: boolean }): Promise<boolean>;
        signIn(): Promise<User>;
        signInSilently(): Promise<User>;
        isSignedIn(): Promise<boolean>;
        signOut(): Promise<null>;
        revokeAccess(): Promise<null>;
        clearCachedAccessToken(token: string): Promise<null>;
        getTokens(): Promise<{ idToken: string; accessToken: string }>;
    };
} 