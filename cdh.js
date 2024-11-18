// Global variable to store dataset images and their features
let imageDataset = [];

// Function to calculate improved Color Difference Histogram with color distribution
function calculateImageFeatures(imageData, bins = 16) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Initialize histograms
    const colorDiffHistogram = new Array(bins * bins * bins).fill(0);
    const colorHistogram = new Array(bins * bins * bins).fill(0);
    
    // Process each pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            // Calculate color distribution
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const rBin = Math.floor(r * (bins / 256));
            const gBin = Math.floor(g * (bins / 256));
            const bBin = Math.floor(b * (bins / 256));
            
            const colorIndex = (rBin * bins * bins) + (gBin * bins) + bBin;
            colorHistogram[colorIndex]++;
            
            // Calculate color differences with neighbors
            if (x < width - 1 && y < height - 1) {
                // Right neighbor
                const rightI = i + 4;
                // Bottom neighbor
                const bottomI = ((y + 1) * width + x) * 4;
                
                // Calculate differences
                const dr1 = Math.abs(r - data[rightI]);
                const dg1 = Math.abs(g - data[rightI + 1]);
                const db1 = Math.abs(b - data[rightI + 2]);
                
                const dr2 = Math.abs(r - data[bottomI]);
                const dg2 = Math.abs(g - data[bottomI + 1]);
                const db2 = Math.abs(b - data[bottomI + 2]);
                
                // Average the differences
                const dr = (dr1 + dr2) / 2;
                const dg = (dg1 + dg2) / 2;
                const db = (db1 + db2) / 2;
                
                // Quantize differences
                const drBin = Math.min(Math.floor(dr * (bins / 256)), bins - 1);
                const dgBin = Math.min(Math.floor(dg * (bins / 256)), bins - 1);
                const dbBin = Math.min(Math.floor(db * (bins / 256)), bins - 1);
                
                const diffIndex = (drBin * bins * bins) + (dgBin * bins) + dbBin;
                colorDiffHistogram[diffIndex]++;
            }
        }
    }
    
    // Normalize histograms
    const totalDiff = colorDiffHistogram.reduce((a, b) => a + b, 0);
    const totalColor = colorHistogram.reduce((a, b) => a + b, 0);
    
    const normalizedDiffHist = colorDiffHistogram.map(v => v / totalDiff);
    const normalizedColorHist = colorHistogram.map(v => v / totalColor);
    
    // Calculate average colors
    const avgR = data.filter((_, i) => i % 4 === 0).reduce((a, b) => a + b, 0) / (width * height);
    const avgG = data.filter((_, i) => i % 4 === 1).reduce((a, b) => a + b, 0) / (width * height);
    const avgB = data.filter((_, i) => i % 4 === 2).reduce((a, b) => a + b, 0) / (width * height);
    
    return {
        colorDiffHist: normalizedDiffHist,
        colorHist: normalizedColorHist,
        avgColor: [avgR, avgG, avgB]
    };
}

// Function to calculate improved similarity between images
function calculateSimilarity(features1, features2) {
    // Calculate histogram intersection for both color diff and color histograms
    let diffSimilarity = 0;
    let colorSimilarity = 0;
    
    for (let i = 0; i < features1.colorDiffHist.length; i++) {
        diffSimilarity += Math.min(features1.colorDiffHist[i], features2.colorDiffHist[i]);
        colorSimilarity += Math.min(features1.colorHist[i], features2.colorHist[i]);
    }
    
    // Calculate color difference between average colors
    const colorDiff = Math.sqrt(
        Math.pow(features1.avgColor[0] - features2.avgColor[0], 2) +
        Math.pow(features1.avgColor[1] - features2.avgColor[1], 2) +
        Math.pow(features1.avgColor[2] - features2.avgColor[2], 2)
    ) / 441.6729559300637; // Max possible distance (sqrt(255^2 * 3))
    
    const avgColorSimilarity = 1 - colorDiff;
    
    // Weighted combination of similarities
    return (0.4 * diffSimilarity) + (0.4 * colorSimilarity) + (0.2 * avgColorSimilarity);
}

// Function to process image and extract features
async function processImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Create canvas to get image data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 256;  // Normalize size
            canvas.height = 256;
            ctx.drawImage(img, 0, 0, 256, 256);
            const imageData = ctx.getImageData(0, 0, 256, 256);
            
            // Calculate features
            const features = calculateImageFeatures(imageData);
            resolve({
                file: file,
                url: URL.createObjectURL(file),
                features: features
            });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Dataset upload handling
const datasetInput = document.getElementById('datasetInput');
const datasetProgress = document.getElementById('datasetProgress');
const uploadStatus = document.getElementById('uploadStatus');
const datasetDropZone = document.getElementById('datasetDropZone');

datasetInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
        uploadStatus.textContent = 'Processing dataset...';
        datasetProgress.style.width = '0%';

        // Process each image
        imageDataset = [];
        for (let i = 0; i < files.length; i++) {
            const processedImage = await processImage(files[i]);
            imageDataset.push(processedImage);
            
            const progress = ((i + 1) / files.length) * 100;
            datasetProgress.style.width = progress + '%';
        }

        // Show preview
        const previewDiv = document.createElement('div');
        previewDiv.style.marginTop = '10px';
        previewDiv.innerHTML = `
            <p>Dataset loaded: ${files.length} images</p>
            <img src="${imageDataset[0].url}" 
                 style="max-width: 200px; max-height: 200px; object-fit: contain; margin-top: 10px;">
        `;
        
        const existingPreview = datasetDropZone.querySelector('div');
        if (existingPreview) {
            existingPreview.remove();
        }
        datasetDropZone.appendChild(previewDiv);

        uploadStatus.textContent = `Successfully processed ${files.length} images`;

    } catch (error) {
        uploadStatus.textContent = 'Error: ' + error.message;
        datasetProgress.style.width = '0%';
    }
});

// Search functionality
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const searchDropZone = document.getElementById('searchDropZone');

searchInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Show preview
        const previewDiv = document.createElement('div');
        previewDiv.style.marginTop = '10px';
        previewDiv.innerHTML = `
            <p>Processing search image...</p>
            <img src="${URL.createObjectURL(file)}" 
                 style="max-width: 200px; max-height: 200px; object-fit: contain; margin-top: 10px;">
        `;
        
        const existingPreview = searchDropZone.querySelector('div');
        if (existingPreview) {
            existingPreview.remove();
        }
        searchDropZone.appendChild(previewDiv);

        resultsGrid.innerHTML = '<p>Finding similar images...</p>';

        // Process search image
        const searchImage = await processImage(file);

        // Find similar images
        const results = imageDataset.map(datasetImage => ({
            image: datasetImage,
            similarity: calculateSimilarity(searchImage.features, datasetImage.features)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 6);  // Top 6 matches

        displayResults(results);

    } catch (error) {
        resultsGrid.innerHTML = `<p>Error: ${error.message}</p>`;
    }
});

function displayResults(results) {
    resultsGrid.innerHTML = results.map(result => `
        <div class="result-card">
            <img src="${result.image.url}" 
                 alt="Similar image"
                 style="width: 100%; height: 150px; object-fit: cover;">
            <div class="result-info">
                <span class="similarity-score">${(result.similarity * 100).toFixed(1)}% Match</span>
                <p>${result.image.file.name}</p>
            </div>
        </div>
    `).join('');
}

// Drag and drop handling remains the same
['datasetDropZone', 'searchDropZone'].forEach(id => {
    const element = document.getElementById(id);
    const input = document.getElementById(id === 'datasetDropZone' ? 'datasetInput' : 'searchInput');

    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.style.borderColor = '#4a90e2';
        element.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
    });

    element.addEventListener('dragleave', (e) => {
        e.preventDefault();
        element.style.borderColor = '#ccc';
        element.style.backgroundColor = 'transparent';
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.style.borderColor = '#ccc';
        element.style.backgroundColor = 'transparent';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            input.dispatchEvent(new Event('change'));
        }
    });
});
