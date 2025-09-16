import { spawn } from 'child_process';

let config = null;

// Initialize services module with config
export function initializeServices(appConfig) {
  config = appConfig;
  console.log('Services module initialized with config');
}

// Function to check if a service is running
export async function checkServiceHealth(url, serviceName) {
  try {
    const response = await fetch(url);
    console.log(`✓ ${serviceName} is running at ${url}`);
    return true;
  } catch (error) {
    console.log(`✗ ${serviceName} is not responding at ${url}`);
    return false;
  }
}

// Function to launch a service
export function launchService(launchPath, serviceName) {
  if (!launchPath || launchPath.trim() === '') {
    console.log(`⚠ No launch path configured for ${serviceName}`);
    return false;
  }

  try {
    console.log(`🚀 Attempting to launch ${serviceName} using: ${launchPath}`);
    
    // Split the command and arguments
    const parts = launchPath.trim().split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    
    const process = spawn(command, args, {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'], // Explicitly ignore all stdio
      shell: true,
    });
    
    // Completely detach the process from the parent
    process.unref();
    
    // On Windows, we can also use process.disconnect() if it's available
    if (process.disconnect && typeof process.disconnect === 'function') {
      process.disconnect();
    }
    
    console.log(`📡 ${serviceName} launch command executed and detached (PID: ${process.pid})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to launch ${serviceName}:`, error);
    return false;
  }
}

// Function to check ComfyUI specifically using history endpoint
export async function checkComfyUIHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/history`);
    // Accept any response as "correctly running" - ComfyUI returns {} when running
    if (response.ok) {
      console.log(`✓ ComfyUI is running at ${baseUrl}`);
      return true;
    } else {
      console.log(`✗ ComfyUI history endpoint returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ComfyUI is not responding at ${baseUrl}/history`);
    console.log(error);
    return false;
  }
}

// Function to check and start services
export async function checkAndStartServices() {
  if (!config) {
    throw new Error('Services module not initialized with config');
  }

  console.log('\n🔍 Checking service health...');
  
  // Check Ollama
  const ollamaRunning = await checkServiceHealth(config.ollamaAPIPath, 'Ollama');
  if (!ollamaRunning) {
    launchService(config.ollamaLaunchPath, 'Ollama');
  }
  
  // Check ComfyUI using the history endpoint
  const comfyuiRunning = await checkComfyUIHealth(config.comfyuiAPIPath);
  if (!comfyuiRunning) {
    launchService(config.comfyuiLaunchPath, 'ComfyUI');
  }
  
  console.log('🎯 Service initialization complete\n');
}

// Getter functions for API paths
export function getOllamaAPIPath() {
  if (!config) {
    throw new Error('Services module not initialized - config not available');
  }
  return config.ollamaAPIPath;
}

export function getComfyUIAPIPath() {
  if (!config) {
    throw new Error('Services module not initialized - config not available');
  }
  return config.comfyuiAPIPath;
}

// Get the full config object
export function getConfig() {
  if (!config) {
    throw new Error('Services module not initialized - config not available');
  }
  return config;
}
