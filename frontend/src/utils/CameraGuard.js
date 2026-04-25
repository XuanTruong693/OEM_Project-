export const CameraGuard = {
  // Blacklist of common virtual camera driver keywords
  BLACKLIST: [
    "OBS",
    "ManyCam",
    "Snap Camera",
    "vMix",
    "DroidCam",
    "SplitCam",
    "XSplit",
    "Camo",
    "AlterCam",
    "Fake Camera"
  ],

  /**
   * Checks if a specific label belongs to a virtual camera.
   */
  isVirtual(label) {
    if (!label) return false;
    const upperLabel = label.toUpperCase();
    return this.BLACKLIST.some(keyword => upperLabel.includes(keyword.toUpperCase()));
  },

  /**
   * Detects if any connected camera is likely a virtual driver.
   * Returns { detected: boolean, devices: Array }
   */
  async detectVirtualCameras() {
    try {
      // We don't want to trigger another getUserMedia here if possible, 
      // but enumerateDevices labels are empty without it.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");

      const virtualDevices = videoDevices.filter(device => this.isVirtual(device.label));

      return {
        detected: virtualDevices.length > 0,
        devices: virtualDevices
      };
    } catch (error) {
      console.error("CameraGuard Error:", error);
      return { detected: false, devices: [] };
    }
  },

  /**
   * Listens for device changes (e.g., plugging in a virtual camera)
   */
  onDeviceChange(callback) {
    navigator.mediaDevices.ondevicechange = async () => {
      const result = await this.detectVirtualCameras();
      callback(result);
    };
  }
};
