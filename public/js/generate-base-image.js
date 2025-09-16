// Generate Base Image Module
import { getCurrentDescription } from './autocomplete-setup.js';
import { showDialog } from './custom-dialog.js';
import { showToast, showSuccessToast, showErrorToast } from './custom-toast.js';
import { loadTags, getTags } from './tags.js';

document.addEventListener('DOMContentLoaded', function() {
  // Tags are now auto-loaded by the tags module, no need to fetch them here
  const generateButton = document.getElementById('generate-btn');
  const descriptionTextarea = document.getElementById('description');
  
  if (!generateButton) {
    console.error('Generate button not found in the DOM');
    return;
  }

  if (!descriptionTextarea) {
    console.error('Description textarea not found in the DOM');
    return;
  }

  // Add click event listener
  generateButton.addEventListener('click', async function() {
    const descriptionText = getCurrentDescription();
    
    if (!descriptionText.trim()) {
      showErrorToast('Please enter a description before generating an image.');
      return;
    }

    // Disable UI during request
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';
    descriptionTextarea.disabled = true;
    
    // Show processing toast
    showToast('Sending generation request to ComfyUI...');

    try {
      const response = await fetch('/generate/img2img', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: descriptionText
        })
      });

      const result = await response.json();

      if (response.ok) {
        showSuccessToast('Image generated successfully!');
        console.log('Generation result:', result);
        
        // Create and display the generated image with analysis
        if (result.data && result.data.imageUrl) {
          // Enhance tags with AI description matching - left unused for now
          // const enhancedTags = performTagMatching(result.data.tags, result.data.description);
          displayGeneratedImage(result.data.imageUrl, result.data.description, result.data.tags, result.data.seed);
        }
      } else {
        throw new Error(result.error || 'Failed to generate image');
      }

    } catch (error) {
      console.error('Error generating image:', error);
      showErrorToast(`Generation failed: ${error.message}`);
    } finally {
      // Re-enable UI
      generateButton.disabled = false;
      generateButton.textContent = 'Generate';
      descriptionTextarea.disabled = false;
    }
  });
});

// Tag matching functionality - enhance original tags with AI description analysis
function performTagMatching(originalTags, description) {
  const fullTagList = getTags();
  
  if (!description || !fullTagList.length) {
    console.log('Tag matching: No description or tag list available for matching');
    return originalTags;
  }

  console.log('Tag matching: Starting tag matching process');
  console.log('Tag matching: Original tags:', originalTags);
  console.log('Tag matching: Description:', description);

  // Prepare description for matching (lowercase for case-insensitive search)
  const processedDescription = description.toLowerCase();
  console.log('Tag matching: Processed description:', processedDescription);

  // Search for matching tags using regex word boundaries
  const matchedTags = [];
  
  for (const tag of fullTagList) {
    const tagLower = tag.toLowerCase();
    
    // Create regex pattern with word boundaries to avoid partial matches
    // \b matches word boundaries (non-letter before/after)
    const regexPattern = new RegExp(`[^\\w\\d]${tagLower}[^\\w\\d]`, 'i');
    
    // Test if the tag pattern matches in the description
    if (regexPattern.test(processedDescription)) {
      matchedTags.push(tag);
      console.log('Tag matching: Found matching tag:', tag);
    }
  }

  console.log('Tag matching: All matched tags:', matchedTags);

  // Add matched tags to the end of original tags
  let enhancedTags = originalTags || '';
  
  if (matchedTags.length > 0) {
    // Remove duplicates by checking if tags are already present (all tags now use spaces)
    const existingTagsLower = enhancedTags.toLowerCase().split(',').map(t => t.trim());
    const newTags = matchedTags.filter(tag => 
      !existingTagsLower.includes(tag.toLowerCase())
    );
    
    if (newTags.length > 0) {
      enhancedTags += (enhancedTags ? ', ' : '') + newTags.join(', ');
      console.log('Tag matching: Enhanced tags with matches:', enhancedTags);
    } else {
      console.log('Tag matching: No new tags to add (all were duplicates)');
    }
  } else {
    console.log('Tag matching: No matching tags found in description');
  }

  return enhancedTags;
}

// Function to display the generated image
function displayGeneratedImage(imageUrl, description, tags, seed) {
  // Find or create a container for generated images
  let imageContainer = document.getElementById('generated-images');
  
  if (!imageContainer) {
    imageContainer = document.createElement('div');
    imageContainer.id = 'generated-images';
    imageContainer.style.marginTop = '20px';
    
    // Add a title
    const title = document.createElement('h3');
    title.textContent = 'Generated Images';
    title.style.color = '#ffffff';
    title.style.marginBottom = '10px';
    
    imageContainer.appendChild(title);
    
    // Insert after the generate button
    const generateButton = document.getElementById('generate-btn');
    generateButton.parentNode.insertBefore(imageContainer, generateButton.nextSibling);
  }
  
  // Create image wrapper
  const imageWrapper = document.createElement('div');
  imageWrapper.style.marginBottom = '20px';
  imageWrapper.style.padding = '15px';
  imageWrapper.style.border = '1px solid #444444';
  imageWrapper.style.borderRadius = '8px';
  imageWrapper.style.backgroundColor = '#1e1e1e';
  
  // Create image element
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = 'Generated image';
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.borderRadius = '4px';
  img.style.display = 'block';
  img.style.marginBottom = '15px';
  
  // Create tags section
  const tagsLabel = document.createElement('label');
  tagsLabel.textContent = 'Tags Used:';
  tagsLabel.style.color = '#ffffff';
  tagsLabel.style.fontSize = '14px';
  tagsLabel.style.fontWeight = 'bold';
  tagsLabel.style.display = 'block';
  tagsLabel.style.marginBottom = '5px';
  
  const tagsTextbox = document.createElement('textarea');
  tagsTextbox.value = tags || '';
  tagsTextbox.readOnly = true;
  tagsTextbox.style.width = '100%';
  tagsTextbox.style.minHeight = '60px';
  tagsTextbox.style.padding = '8px';
  tagsTextbox.style.border = '1px solid #555555';
  tagsTextbox.style.borderRadius = '4px';
  tagsTextbox.style.backgroundColor = '#2d2d2d';
  tagsTextbox.style.color = '#ffffff';
  tagsTextbox.style.fontSize = '12px';
  tagsTextbox.style.resize = 'vertical';
  tagsTextbox.style.marginBottom = '15px';
  
  // Create description section
  const descriptionLabel = document.createElement('label');
  descriptionLabel.textContent = 'AI Description:';
  descriptionLabel.style.color = '#ffffff';
  descriptionLabel.style.fontSize = '14px';
  descriptionLabel.style.fontWeight = 'bold';
  descriptionLabel.style.display = 'block';
  descriptionLabel.style.marginBottom = '5px';
  
  const descriptionTextbox = document.createElement('textarea');
  descriptionTextbox.value = description || 'No description available';
  descriptionTextbox.readOnly = true;
  descriptionTextbox.style.width = '100%';
  descriptionTextbox.style.minHeight = '80px';
  descriptionTextbox.style.padding = '8px';
  descriptionTextbox.style.border = '1px solid #555555';
  descriptionTextbox.style.borderRadius = '4px';
  descriptionTextbox.style.backgroundColor = '#2d2d2d';
  descriptionTextbox.style.color = '#ffffff';
  descriptionTextbox.style.fontSize = '12px';
  descriptionTextbox.style.resize = 'vertical';
  
  // Create seed section
  const seedLabel = document.createElement('label');
  seedLabel.textContent = 'Seed Number:';
  seedLabel.style.color = '#ffffff';
  seedLabel.style.fontSize = '14px';
  seedLabel.style.fontWeight = 'bold';
  seedLabel.style.display = 'block';
  seedLabel.style.marginTop = '15px';
  seedLabel.style.marginBottom = '5px';
  
  const seedTextbox = document.createElement('input');
  seedTextbox.type = 'text';
  seedTextbox.value = seed || 'Unknown';
  seedTextbox.readOnly = true;
  seedTextbox.style.width = '100%';
  seedTextbox.style.padding = '8px';
  seedTextbox.style.border = '1px solid #555555';
  seedTextbox.style.borderRadius = '4px';
  seedTextbox.style.backgroundColor = '#2d2d2d';
  seedTextbox.style.color = '#ffffff';
  seedTextbox.style.fontSize = '12px';
  
  // Handle image load/error
  img.onload = function() {
    console.log('Image loaded successfully:', imageUrl);
  };
  
  img.onerror = function() {
    console.error('Failed to load image:', imageUrl);
    img.alt = 'Failed to load image';
    img.style.backgroundColor = '#333333';
    img.style.color = '#ff6b6b';
    img.style.textAlign = 'center';
    img.style.padding = '20px';
  };
  
  // Assemble and add to container
  imageWrapper.appendChild(img);
  imageWrapper.appendChild(tagsLabel);
  imageWrapper.appendChild(tagsTextbox);
  imageWrapper.appendChild(descriptionLabel);
  imageWrapper.appendChild(descriptionTextbox);
  imageWrapper.appendChild(seedLabel);
  imageWrapper.appendChild(seedTextbox);
  
  // Insert at the beginning (newest first)
  const firstChild = imageContainer.children[1]; // Skip the title
  if (firstChild) {
    imageContainer.insertBefore(imageWrapper, firstChild);
  } else {
    imageContainer.appendChild(imageWrapper);
  }
}
