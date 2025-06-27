// SimcirJS PNG Export Color Fix
// This file provides an enhanced PNG export function that properly preserves colors

// Enhanced saveAsImage function with comprehensive color preservation
function saveAsImageWithColorFix() {
  // Generate filename with current date and time
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  var hours = String(now.getHours()).padStart(2, '0');
  var minutes = String(now.getMinutes()).padStart(2, '0');
  var seconds = String(now.getSeconds()).padStart(2, '0');
  var timestamp = year + month + day + '_' + hours + minutes + seconds;
  
  // Find the workspace
  var $workspace = $('.simcir-workspace');
  if ($workspace.length === 0) {
    alert('No circuit workspace found');
    return;
  }

  // Save JSON file first
  try {
    var circuitData = simcir.controller($workspace[0]).text();
    var jsonBlob = new Blob([circuitData], {type: 'application/json'});
    var jsonUrl = URL.createObjectURL(jsonBlob);
    var jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = 'circuit_' + timestamp + '.json';
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);
    console.log('JSON saved successfully');
  } catch (e) {
    console.error('Failed to save JSON:', e);
  }

  // Enhanced PNG export with proper color preservation
  try {
    console.log('Starting enhanced PNG export...');
    
    var svgElement = $workspace.find('svg')[0];
    if (!svgElement) {
      svgElement = $workspace[0].querySelector ? $workspace[0].querySelector('svg') : null;
      if (!svgElement && $workspace[0].tagName === 'svg') {
        svgElement = $workspace[0];
      }
    }
    
    if (!svgElement) {
      console.error('SVG workspace element not found');
      alert('Failed to find SVG element for image export');
      return;
    }
    
    // Get dimensions
    var bbox = svgElement.getBBox ? svgElement.getBBox() : 
               {x: 0, y: 0, width: parseInt($workspace.attr('width')) || 800, 
                height: parseInt($workspace.attr('height')) || 600};
    var width = bbox.width || parseInt($workspace.attr('width')) || 800;
    var height = bbox.height || parseInt($workspace.attr('height')) || 600;
    
    console.log('SVG dimensions:', width, 'x', height);
    
    // Clone SVG
    var svgClone = svgElement.cloneNode(true);
    
    // Set proper SVG attributes
    svgClone.setAttribute('width', width);
    svgClone.setAttribute('height', height);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    
    // Comprehensive CSS rules for color preservation
    var comprehensiveCSS = `
      /* Core SimcirJS styles */
      .simcir-pin-hole { fill: #cccccc; stroke: none; }
      .simcir-toolbox { fill: #eeeeee; }
      .simcir-scrollbar { fill: #cccccc; }
      .simcir-scrollbar-bar { fill: #aaaaaa; }
      .simcir-scrollbar-bar:hover { fill: #999999; }
      .simcir-connector { stroke-width: 1; stroke: #0000ff; stroke-linecap: round; fill: none; }
      .simcir-device { fill: #cccccc; stroke-width: 2; stroke: #666666; }
      .simcir-device-selected { stroke: #0000ff; }
      .simcir-device-label { fill: #000000; stroke-width: 0; stroke: none; font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; }
      .simcir-selection-rect { fill: none; stroke-width: 1; stroke: #0000ff; }
      .simcir-node-type-in { fill: #ffcc00; }
      .simcir-node-type-out { fill: #ffffff; }
      .simcir-node { stroke-width: 1; stroke: #000000; }
      .simcir-node-hot { stroke: #ff0000; }
      .simcir-node-hover { stroke: #ffff00; }
      .simcir-node-label { fill: #000000; stroke: none; }
      .simcir-port { stroke-width: 1; stroke: #000000; }
      .simcir-port-hole { stroke: none; fill: #000000; }
      
      /* BasicSet styles */
      .simcir-basicset-dc { fill: #ffcccc; }
      .simcir-basicset-switch { fill: #ccccff; }
      .simcir-basicset-switch-button-pressed { fill: #9999cc; }
      .simcir-basicset-symbol { stroke: #000000; stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; fill: none; }
      .simcir-basicset-osc { fill: #ffcccc; }
      .simcir-basicset-knob { stroke: none; fill: #333333; }
      .simcir-basicset-knob-mark { stroke: #ffffff; stroke-width: 3; }
      
      /* Additional color states */
      .simcir-node circle { fill: inherit; stroke: inherit; }
      .simcir-node-hot circle { fill: #ffff00; stroke: #ff0000; }
      .simcir-node-hover circle { fill: #ffff00; stroke: #ffff00; }
      
      /* Text styling */
      text { font-family: Arial, sans-serif; font-size: 12px; }
      .simcir-device-label text { fill: #000000; }
      .simcir-node-label text { fill: #000000; }
    `;
    
    // Add extracted CSS rules from stylesheets
    var extractedRules = [];
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var styleSheet = document.styleSheets[i];
        try {
          var rules = styleSheet.cssRules || styleSheet.rules;
          for (var j = 0; j < rules.length; j++) {
            var rule = rules[j];
            if (rule.selectorText && rule.cssText && (
                rule.selectorText.indexOf('simcir') !== -1 ||
                rule.selectorText.indexOf('basicset') !== -1)) {
              extractedRules.push(rule.cssText);
            }
          }
        } catch (e) {
          console.warn('Could not read stylesheet:', e);
        }
      }
    } catch (e) {
      console.warn('Error extracting CSS rules:', e);
    }
    
    // Combine all CSS
    var finalCSS = comprehensiveCSS + '\n' + extractedRules.join('\n');
    
    // Apply computed styles inline to preserve current state
    var applyComputedStyles = function(element) {
      if (element.nodeType === 1) {
        var computedStyle = window.getComputedStyle(element);
        var importantProps = ['fill', 'stroke', 'stroke-width', 'opacity'];
        
        var inlineStyle = '';
        for (var i = 0; i < importantProps.length; i++) {
          var prop = importantProps[i];
          var value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'none' && value !== 'auto' && value !== 'initial') {
            inlineStyle += prop + ': ' + value + '; ';
          }
        }
        
        if (inlineStyle) {
          var existingStyle = element.getAttribute('style') || '';
          element.setAttribute('style', existingStyle + '; ' + inlineStyle);
        }
      }
      
      // Process children
      for (var i = 0; i < element.children.length; i++) {
        applyComputedStyles(element.children[i]);
      }
    };
    
    // Apply computed styles to all elements
    applyComputedStyles(svgClone);
    
    // Create and insert style element
    var styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = finalCSS;
    svgClone.insertBefore(styleElement, svgClone.firstChild);
    
    console.log('Applied comprehensive CSS rules');
    
    // Serialize SVG
    var svgData = new XMLSerializer().serializeToString(svgClone);
    
    // Clean up SVG data
    svgData = svgData.replace(/&nbsp;/g, '&#160;');
    svgData = svgData.replace(/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
    
    console.log('SVG data length:', svgData.length);
    
    // Create image
    var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    
    var img = new Image();
    img.onload = function() {
      console.log('Image loaded successfully:', img.width, 'x', img.height);
      
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      
      // Set canvas size with scale factor for better quality
      var scaleFactor = 2;
      canvas.width = (img.width || width) * scaleFactor;
      canvas.height = (img.height || height) * scaleFactor;
      
      // Scale context
      ctx.scale(scaleFactor, scaleFactor);
      
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);
      
      // Draw image
      ctx.drawImage(img, 0, 0);
      
      // Export as PNG
      if (canvas.toBlob) {
        canvas.toBlob(function(blob) {
          if (blob) {
            var pngUrl = URL.createObjectURL(blob);
            var pngLink = document.createElement('a');
            pngLink.href = pngUrl;
            pngLink.download = 'circuit_' + timestamp + '.png';
            document.body.appendChild(pngLink);
            pngLink.click();
            document.body.removeChild(pngLink);
            URL.revokeObjectURL(pngUrl);
            console.log('PNG saved successfully with enhanced color preservation');
          } else {
            console.error('Failed to create PNG blob');
            alert('Failed to create PNG file');
          }
        }, 'image/png');
      } else {
        // Fallback for older browsers
        var dataUrl = canvas.toDataURL('image/png');
        var pngLink = document.createElement('a');
        pngLink.href = dataUrl;
        pngLink.download = 'circuit_' + timestamp + '.png';
        document.body.appendChild(pngLink);
        pngLink.click();
        document.body.removeChild(pngLink);
        console.log('PNG saved using fallback method');
      }
    };
    
    img.onerror = function(e) {
      console.error('Failed to load SVG image:', e);
      console.log('SVG data preview:', svgData.substring(0, 500));
      alert('Failed to convert SVG to image. Please check the console for details.');
    };
    
    // Add timeout for debugging
    setTimeout(function() {
      if (!img.complete) {
        console.warn('Image loading timeout - may indicate SVG rendering issues');
      }
    }, 10000);
    
    img.src = svgDataUrl;
    
  } catch (error) {
    console.error('Error in enhanced PNG export:', error);
    alert('Failed to save image: ' + error.message);
  }
}

// Debugging function to test color extraction
function debugColorExtraction() {
  console.log('=== Color Extraction Debug ===');
  
  var $workspace = $('.simcir-workspace');
  if ($workspace.length === 0) {
    console.log('No workspace found');
    return;
  }
  
  var svgElement = $workspace.find('svg')[0] || $workspace[0];
  if (!svgElement) {
    console.log('No SVG element found');
    return;
  }
  
  // Test computed styles
  var testElements = svgElement.querySelectorAll('[class*="simcir"]');
  console.log('Found', testElements.length, 'elements with simcir classes');
  
  for (var i = 0; i < Math.min(testElements.length, 10); i++) {
    var el = testElements[i];
    var computedStyle = window.getComputedStyle(el);
    console.log('Element:', el.tagName, 'Class:', el.className);
    console.log('  Fill:', computedStyle.getPropertyValue('fill'));
    console.log('  Stroke:', computedStyle.getPropertyValue('stroke'));
    console.log('  Stroke-width:', computedStyle.getPropertyValue('stroke-width'));
  }
  
  // Test CSS rules extraction
  var extractedRules = [];
  for (var i = 0; i < document.styleSheets.length; i++) {
    var styleSheet = document.styleSheets[i];
    try {
      var rules = styleSheet.cssRules || styleSheet.rules;
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (rule.selectorText && (
            rule.selectorText.indexOf('simcir') !== -1 ||
            rule.selectorText.indexOf('basicset') !== -1)) {
          extractedRules.push(rule.cssText);
        }
      }
    } catch (e) {
      console.warn('Could not read stylesheet:', e);
    }
  }
  
  console.log('Extracted CSS rules:', extractedRules.length);
  extractedRules.forEach(function(rule, index) {
    if (index < 5) console.log('Rule', index, ':', rule);
  });
  
  console.log('=== End Debug ===');
}

// Instructions
console.log('SimcirJS Color Fix loaded!');
console.log('Use saveAsImageWithColorFix() to export with proper colors');
console.log('Use debugColorExtraction() to test color extraction');