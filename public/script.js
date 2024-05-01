window.addEventListener('DOMContentLoaded', (event) => {
    // Container elements
    const containerEl = document.getElementById('canvas');
    const svgContainer = document.getElementsByClassName('svgContainer').item(0);
    const buttonContainer = document.getElementsByClassName('drawing-buttons').item(0);
    
    // Buttons
    const clearBtn = document.getElementById('clearButton');
    const undoBtn = document.getElementById('undoButton');
    const doneBtn = document.getElementById('done');

    // SVG element and hidden input
    var SVGelement = document.getElementsByClassName('svgElement').item(0);
    var drawing = document.getElementsByClassName('drawing').item(0);

    // Drawer object
    var drawer;

    // Initialize drawer
    drawer = new Drawer(SVGelement, {hiddenElement: drawing, readOnly: false, strokeWidth: 8, pathColor: '#6300b436'});

});