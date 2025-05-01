import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '../api/recipes';

// Define the context type
interface FavoritesContextType {
    favorites: Recipe[];
    addFavorite: (recipe: Recipe) => Promise<void>;
    removeFavorite: (recipeId: string) => Promise<void>;
    isFavorite: (recipeId: string) => boolean;
}

// Create the context with default values
const FavoritesContext = createContext<FavoritesContextType>({
    favorites: [],
    addFavorite: async () => { },
    removeFavorite: async () => { },
    isFavorite: () => false,
});

// Storage key
const FAVORITES_STORAGE_KEY = 'favorites';

// Provider component
export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [favorites, setFavorites] = useState<Recipe[]>([]);

    // Load favorites from storage on mount
    useEffect(() => {
        const loadFavorites = async () => {
            try {
                const storedFavorites = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
                if (storedFavorites) {
                    setFavorites(JSON.parse(storedFavorites));
                }
            } catch (error) {
                console.error('Error loading favorites:', error);
            }
        };

        loadFavorites();
    }, []);

    // Save favorites to storage whenever they change
    useEffect(() => {
        const saveFavorites = async () => {
            try {
                await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
            } catch (error) {
                console.error('Error saving favorites:', error);
            }
        };

        if (favorites.length > 0) {
            saveFavorites();
        }
    }, [favorites]);

    // Add a recipe to favorites
    const addFavorite = async (recipe: Recipe) => {
        // Check if recipe is already a favorite
        if (!favorites.some(fav => fav.id === recipe.id)) {
            const newFavorites = [...favorites, recipe];
            setFavorites(newFavorites);
            try {
                await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
            } catch (error) {
                console.error('Error saving favorite:', error);
            }
        }
    };

    // Remove a recipe from favorites
    const removeFavorite = async (recipeId: string) => {
        const newFavorites = favorites.filter(recipe => recipe.id !== recipeId);
        setFavorites(newFavorites);
        try {
            await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
        } catch (error) {
            console.error('Error removing favorite:', error);
        }
    };

    // Check if a recipe is in favorites
    const isFavorite = (recipeId: string) => {
        return favorites.some(recipe => recipe.id === recipeId);
    };

    return (
        <FavoritesContext.Provider
            value={{
                favorites,
                addFavorite,
                removeFavorite,
                isFavorite,
            }}
        >
            {children}
        </FavoritesContext.Provider>
    );
};

// Custom hook for using favorites
export const useFavorites = () => useContext(FavoritesContext);

export default FavoritesContext; 