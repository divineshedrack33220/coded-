// Avatar upload
avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
        console.log('No file selected for avatar');
        return;
    }
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
        showAlert('Only JPEG or PNG images are allowed');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showAlert('Avatar image must be less than 5MB');
        return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Please log in to upload images');
        window.location.href = '/auth.html';
        return;
    }
    try {
        avatarLoading.style.display = 'block';
        avatarCameraBtn.disabled = true;
        uploadBtn.disabled = true;
        console.log('Avatar file details:', { name: file.name, size: file.size || 'unknown', type: file.type, lastModified: file.lastModified, isIOS });
        const formData = new FormData();
        formData.append('avatar', file); // Use 'avatar' field
        const response = await fetch(`${API_URL}/api/users/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        console.log('Avatar upload response:', { status: response.status, statusText: response.statusText, data });
        if (!response.ok) {
            throw new Error(data.error || data.details || `Avatar upload failed with status ${response.status}`);
        }
        if (!data.avatarUrl) {
            throw new Error('No avatar URL returned from upload');
        }
        if (!data.avatarUrl.startsWith('https://res.cloudinary.com')) {
            throw new Error('Invalid Cloudinary URL for avatar');
        }
        avatarUrl = data.avatarUrl;
        avatarPreview.src = data.avatarUrl;
        avatarPreview.classList.remove('hidden');
        avatarPlaceholder.classList.add('hidden');
        showAlert('Avatar uploaded successfully!', 'success');
    } catch (error) {
        console.error('Avatar upload error:', { message: error.message, stack: error.stack });
        showAlert(error.message.includes('Invalid or expired token') ? 'Session expired. Please log in again.' : `Failed to upload avatar: ${error.message}`);
        if (error.message.includes('Invalid or expired token')) {
            localStorage.removeItem('token');
            window.location.href = '/auth.html';
        }
    } finally {
        avatarLoading.style.display = 'none';
        avatarCameraBtn.disabled = false;
        uploadBtn.disabled = false;
    }
});

// Image uploads
const imageUrls = Array(5).fill(null);
const uploadedImageNames = new Set();
for (let i = 1; i <= 5; i++) {
    const imageInput = document.getElementById(`imageInput${i}`);
    const imagePlaceholder = document.getElementById(`imagePlaceholder${i}`);
    const imageCameraBtn = imageInput.nextElementSibling;
    const imageLoading = document.getElementById(`imageLoading${i}`);
    imageCameraBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            console.log(`No file selected for image ${i}`);
            return;
        }
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            showAlert(`Only JPEG or PNG images are allowed for image ${i}`);
            return;
        }
        if (uploadedImageNames.has(file.name) || (avatarInput.files[0] && avatarInput.files[0].name === file.name)) {
            showAlert('This image has already been uploaded');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showAlert(`Image ${i} must be less than 5MB`);
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            showAlert('Please log in to upload images');
            window.location.href = '/auth.html';
            return;
        }
        try {
            imageLoading.style.display = 'block';
            imageCameraBtn.disabled = true;
            console.log(`Image ${i} file details:`, { name: file.name, size: file.size || 'unknown', type: file.type, lastModified: file.lastModified, isIOS });
            const formData = new FormData();
            formData.append('images', file); // Use 'images' field
            const response = await fetch(`${API_URL}/api/users/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            console.log(`Image ${i} upload response:`, { status: response.status, statusText: response.statusText, data });
            if (!response.ok) {
                throw new Error(data.error || data.details || `Image ${i} upload failed with status ${response.status}`);
            }
            if (!data.imageUrls || !data.imageUrls[0]) {
                throw new Error(`No URL returned for image ${i} upload`);
            }
            if (!data.imageUrls[0].startsWith('https://res.cloudinary.com')) {
                throw new Error(`Invalid Cloudinary URL for image ${i}`);
            }
            imageUrls[i - 1] = data.imageUrls[0];
            uploadedImageNames.add(file.name);
            const img = document.createElement('img');
            img.src = data.imageUrls[0];
            img.classList.add('image-preview');
            imagePlaceholder.innerHTML = '';
            imagePlaceholder.appendChild(img);
            showAlert(`Image ${i} uploaded successfully!`, 'success');
        } catch (error) {
            console.error(`Image ${i} upload error:`, { message: error.message, stack: error.stack });
            showAlert(error.message.includes('Invalid or expired token') ? 'Session expired. Please log in again.' : `Failed to upload image ${i}: ${error.message}`);
            if (error.message.includes('Invalid or expired token')) {
                localStorage.removeItem('token');
                window.location.href = '/auth.html';
            }
        } finally {
            imageLoading.style.display = 'none';
            imageCameraBtn.disabled = false;
        }
    });
}
