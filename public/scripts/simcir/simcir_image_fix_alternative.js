// Alternative PNG export function for SimcirJS
// Use this if the main fix doesn't work in your browser

// Alternative saveAsImage function with simplified approach
function saveAsImageAlternative() {
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

  // Save JSON file first (this part usually works)
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

  // Method 1: Try html2canvas if available
  if (typeof html2canvas !== 'undefined') {
    console.log('Using html2canvas method');
    html2canvas($workspace[0], {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true
    }).then(function(canvas) {
      canvas.toBlob(function(blob) {
        var pngUrl = URL.createObjectURL(blob);
        var pngLink = document.createElement('a');
        pngLink.href = pngUrl;
        pngLink.download = 'circuit_' + timestamp + '.png';
        document.body.appendChild(pngLink);
        pngLink.click();
        document.body.removeChild(pngLink);
        URL.revokeObjectURL(pngUrl);
        console.log('PNG saved using html2canvas');
      }, 'image/png');
    }).catch(function(error) {
      console.error('html2canvas failed:', error);
      trySimpleMethod();
    });
    return;
  }

  // Method 2: Simple SVG to canvas conversion
  trySimpleMethod();

  function trySimpleMethod() {
    console.log('Using simple method');
    
    try {
      var svgElement = $workspace[0];
      var svgRect = svgElement.getBoundingClientRect();
      var width = svgRect.width || 800;
      var height = svgRect.height || 600;

      // Create a simple SVG string
      var svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">';
      svgString += '<rect width="100%" height="100%" fill="white"/>';
      
      // Add a simple representation of the circuit
      var devices = $workspace.find('.simcir-device');
      devices.each(function(i, device) {
        var $device = $(device);
        var transform = $device.attr('transform') || '';
        var rect = device.getBoundingClientRect();
        var svgRect = svgElement.getBoundingClientRect();
        var x = rect.left - svgRect.left;
        var y = rect.top - svgRect.top;
        
        svgString += '<rect x="' + x + '" y="' + y + '" width="' + (rect.width || 32) + '" height="' + (rect.height || 32) + '" fill="#f0f0f0" stroke="#000" stroke-width="1"/>';
        
        // Add device label if exists
        var label = $device.find('.simcir-device-label').text();
        if (label) {
          svgString += '<text x="' + (x + (rect.width || 32)/2) + '" y="' + (y + (rect.height || 32)/2) + '" text-anchor="middle" font-family="Arial" font-size="12">' + label + '</text>';
        }
      });
      
      // Add connectors as simple lines
      var connectors = $workspace.find('.simcir-connector');
      connectors.each(function(i, connector) {
        var d = $(connector).attr('d') || '';
        if (d) {
          svgString += '<path d="' + d + '" stroke="#000" stroke-width="1" fill="none"/>';
        }
      });
      
      svgString += '</svg>';

      // Convert to image
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;

      var img = new Image();
      img.onload = function() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

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
            console.log('PNG saved using simple method');
          } else {
            alert('Failed to create PNG file');
          }
        }, 'image/png');
      };

      img.onerror = function() {
        console.error('Simple method failed');
        alert('PNG export failed. Try taking a screenshot instead.');
      };

      var svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
      var svgUrl = URL.createObjectURL(svgBlob);
      img.src = svgUrl;

    } catch (error) {
      console.error('Simple method error:', error);
      alert('PNG export failed: ' + error.message);
    }
  }
}

// Instructions for use:
console.log('Alternative PNG export function loaded. Call saveAsImageAlternative() to test.');