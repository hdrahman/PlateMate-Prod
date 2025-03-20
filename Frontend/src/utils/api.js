import axios from 'axios';
import { BACKEND_URL } from './config';

export const uploadImageToBackend = async (imageUri) => {
    try {
        const formData = new FormData();
        formData.append('file', {
            uri: imageUri,
            name: 'photo.jpg',
            type: 'image/jpeg',
        });

        const response = await axios.post(`${BACKEND_URL}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        console.log('Image uploaded successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}; 