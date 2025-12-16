/**
 * Expo Config Plugin to add App Intents support for iOS Action Button
 * 
 * This plugin automatically adds Swift files to the Xcode project.
 * No Xcode needed - EAS Build handles everything!
 */
const { withXcodeProject, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withAppIntents = (config) => {
  // Add App Intents to Info.plist
  config = withInfoPlist(config, (config) => {
    // Note: App Intents don't need NSUserActivityTypes
    // They are automatically discovered by iOS when the app is installed
    // But we can add them for compatibility if needed
    
    return config;
  });

  // Automatically add Swift files to Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    
    // Paths to Swift files (relative to ios/ directory)
    const swiftFiles = [
      'HaloApp/AppIntents/ConfirmCheckinIntent.swift',
      'HaloApp/Modules/CheckinIntentModule.swift',
    ];
    
    // Get the main target (usually "HaloApp")
    const mainTarget = xcodeProject.getTarget('HaloApp') || xcodeProject.getFirstTarget();
    
    if (!mainTarget) {
      console.warn('[App Intents Plugin] Could not find main target, skipping Swift file addition');
      return config;
    }
    
    // Add each Swift file to the project
    swiftFiles.forEach((relativePath) => {
      const fullPath = path.join(projectRoot, 'ios', relativePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.warn(`[App Intents Plugin] Swift file not found: ${fullPath}`);
        return;
      }
      
      // Add file reference to Xcode project
      const fileRef = xcodeProject.addFile(relativePath, mainTarget.uuid, {
        lastKnownFileType: 'sourcecode.swift',
        defaultEncoding: 4, // UTF-8
      });
      
      // Add file to build phases (Compile Sources)
      if (fileRef) {
        xcodeProject.addToPbxBuildFileSection(fileRef);
        xcodeProject.addToPbxSourcesBuildPhase(fileRef);
      }
    });
    
    return config;
  });

  return config;
};

module.exports = withAppIntents;

