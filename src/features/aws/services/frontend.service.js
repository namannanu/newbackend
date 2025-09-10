const axios = require('axios');

class FrontendService {
  constructor() {
    this.baseURL = process.env.FRONTEND_URL || 'https://correct-three.vercel.app';
    this.apiURL = process.env.API_URL || 'https://correct-three.vercel.app/api';
  }

  // Upload face image
  async uploadFaceImage(file, token, fullName = null) {
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (fullName) {
        formData.append('fullName', fullName);
      }

      const response = await axios.post(`${this.apiURL}/face-recognition/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Upload failed');
    }
  }

  // Search for face in collection
  async searchFace(file, token) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(`${this.apiURL}/face-recognition/search`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Search failed');
    }
  }

  // Get all face images
  async getAllFaceImages(token) {
    try {
      const response = await axios.get(`${this.apiURL}/face-recognition`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch face images');
    }
  }

  // Get face image by ID
  async getFaceImage(id, token) {
    try {
      const response = await axios.get(`${this.apiURL}/face-recognition/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch face image');
    }
  }

  // Delete face image
  async deleteFaceImage(id, token) {
    try {
      const response = await axios.delete(`${this.apiURL}/face-recognition/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete face image');
    }
  }

  // Get image from S3
  async getImageFromS3(key, token) {
    try {
      const response = await axios.get(`${this.apiURL}/face-recognition/image/${key}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch image');
    }
  }

  // Search faces by name
  async searchFacesByName(name, token) {
    try {
      const response = await axios.get(`${this.apiURL}/face-recognition/search?name=${encodeURIComponent(name)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to search faces');
    }
  }

  // Login user
  async login(email, password) {
    try {
      const response = await axios.post(`${this.apiURL}/auth/login`, {
        email,
        password
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  // Register user
  async register(userData) {
    try {
      const response = await axios.post(`${this.apiURL}/auth/signup`, userData);

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiURL}/health`);
      return response.data;
    } catch (error) {
      throw new Error('Health check failed');
    }
  }
}

module.exports = new FrontendService(); 