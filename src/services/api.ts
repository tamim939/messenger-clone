const API_URL = ''; // Current host (standard for Express + Vite)

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  const data = await response.json();
  return data.url;
};

// You can add more API calls here for users, chats, etc.
// For now, let's focus on images to save money.
