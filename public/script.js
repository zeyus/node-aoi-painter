

function isWithinBoundary(point, brushPoint) {
    // Calculate the distance between the point and the brush point
    const distance = Math.sqrt(Math.pow(point.x - brushPoint.x, 2) + Math.pow(point.y - brushPoint.y, 2));

    // Check if the distance is within half of the stroke width
    if (distance <= brushPoint.strokeWidth / 2) {
        return true;
    }

    return false;
}


function extractPointsFromSVGPath(svgPathData, strokeWidth, pathAOI) {
    const points = [];
    const commands = svgPathData.match(/[a-df-z]|[\-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-+]?\d+)?/gi);
    
    let currentX = 0;
    let currentY = 0;
    
    for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        
        if (/[MmLlHhVv]/.test(command)) { // MoveTo, LineTo, HorizontalLineTo, VerticalLineTo
            const isRelative = /[mlhv]/.test(command);
            const x = parseFloat(commands[i + 1]) + (isRelative ? currentX : 0);
            const y = parseFloat(commands[i + 2]) + (isRelative ? currentY : 0);
            
            points.push({ x, y, strokeWidth, aoi: pathAOI});
            
            if (/[Mm]/.test(command)) {
                currentX = x;
                currentY = y;
            }
            
            i += 2;
        }
    }
    
    return points;
}





window.addEventListener('DOMContentLoaded', (event) => {
    // Container elements
    const containerEl = document.getElementById('canvas');
    const svgContainer = document.getElementsByClassName('svgContainer').item(0);
    const buttonContainer = document.getElementsByClassName('drawing-buttons').item(0);
    
    // Buttons
    const clearBtn = document.getElementById('clearButton');
    const undoBtn = document.getElementById('undoButton');
    const saveBtn = document.getElementById('save');
    
    const totalPointCount = document.getElementById('point-count');
    const headPointCount = document.getElementById('head-info');

    // Drawing controls
    // size selector radio buttons
    const sizeSelector = document.querySelectorAll('input[name="size"]');
    const aoiSelector = document.querySelectorAll('input[name="aoi"]');

    // SVG element and hidden input
    var SVGelement = document.getElementsByClassName('svgElement').item(0);
    var drawing = document.getElementsByClassName('drawing').item(0);

    const allPoints = [];
    let pointsUnderPath = [];
    // load points from #trial-points > .trial-point
    // data-path-id, data-point-id, data-x, data-y
    const trialPoints = document.querySelectorAll('#trial-points > .trial-point');
    trialPoints.forEach(point => {
        const pathId = point.getAttribute('data-path-id');
        const pointId = point.getAttribute('data-point-id');
        const x = point.getAttribute('data-x');
        const y = point.getAttribute('data-y');
        const aoi = point.getAttribute('data-aoi');

        allPoints.push({ 
            path_id: parseFloat(pathId),
            point_id: parseFloat(pointId),
            x: parseFloat(x),
            y: parseFloat(y),
            aoi: aoi
        });
    });

    // update the total point count
    totalPointCount.innerText = allPoints.length;


    function onStopDraw(drawerobj) {
        // first get the brush strokes
        const brushPathEls = drawerobj.getUserPaths();
        // map and flatten the points from the brush stroke paths
        const brushPoints = brushPathEls.map(path => {
            const strokeWidth = parseInt(path.getAttribute('stroke-width'));
            const pathAOI = path.getAttribute('data-aoi');
            return extractPointsFromSVGPath(path.getAttribute('d'), strokeWidth, pathAOI);
        }).flat();

        // reset all AOIs
        allPoints.forEach(point => {
            point.aoi = 'none';
            // update the point element
            const pointEl = document.querySelector(`.trial-point[data-path-id="${point.path_id}"][data-point-id="${point.point_id}"]`);
            pointEl.setAttribute('data-aoi', '');
        });

        let headPointCount = 0;
        let torsoPointCount = 0;
        let legsPointCount = 0;
        // get all points that lie under the path
        pointsUnderPath = allPoints.filter(point => {
            for (let i = 0; i < brushPoints.length; i++) {
                if (isWithinBoundary(point, brushPoints[i])) {
                    // update the point AOI
                    point.aoi = brushPoints[i].aoi;
                    // update the point element
                    const pointEl = document.querySelector(`.trial-point[data-path-id="${point.path_id}"][data-point-id="${point.point_id}"]`);
                    pointEl.setAttribute('data-aoi', brushPoints[i].aoi);
                    if (brushPoints[i].aoi === 'head') {
                        headPointCount++;
                    } else if (brushPoints[i].aoi === 'torso') {
                        torsoPointCount++;
                    } else if (brushPoints[i].aoi === 'legs') {
                        legsPointCount++;
                    }
                    return true;
                }
            }
            return false;
        });

        // update the head point count
        document.getElementById('head-info').innerText = headPointCount;
        document.getElementById('torso-info').innerText = torsoPointCount;
        document.getElementById('legs-info').innerText = legsPointCount;
    }

    // Drawer object
    var drawer;

    // Initialize drawer
    drawer = new Drawer(SVGelement, {hiddenElement: drawing, readOnly: false, strokeWidth: 8, pathColor: '#6300b436', updateCallback: onStopDraw});

    drawer.setAoi(document.querySelector('input[name="aoi"]:checked').value);
    // Clear button
    clearBtn.addEventListener('click', function() {
        drawer.clearSVG();
    });

    // Undo button
    undoBtn.addEventListener('click', function() {
        drawer.undoAction();
    });

    // Stroke size selector
    sizeSelector.forEach(radio => {
        if (radio.checked) {
            drawer.setStrokeWidth(radio.value);
        }
        radio.addEventListener('change', function() {
            drawer.setStrokeWidth(this.value);
        });
    });

    aoiSelector.forEach(radio => {
        if (radio.checked) {
            drawer.setAoi(radio.value);
            if (radio.value === 'head') {
                drawer.setStrokeColor('#FF000070');
            } else if (radio.value === 'legs') {
                drawer.setStrokeColor('#00FF0070');
            } else if (radio.value === 'torso') {
                drawer.setStrokeColor('#0000FF70');
            }
        }
        radio.addEventListener('change', function() {
            drawer.setAoi(this.value);
            if (radio.value === 'head') {
                drawer.setStrokeColor('#FF000070');
            } else if (radio.value === 'legs') {
                drawer.setStrokeColor('#00FF0070');
            } else if (radio.value === 'torso') {
                drawer.setStrokeColor('#0000FF70');
            }
        });
    });

    // Save button, on click we post all the points to the server
    saveBtn.addEventListener('click', function() {
        const prolificId = document.getElementById('prolific_id').value;
        const trialId = document.getElementById('trial').value;
        const progress = document.getElementById('progress');
        // show progress - remove d-none
        progress.classList.remove('d-none');
        // post the data to the server
        fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prolific_id: prolificId,
                trial: trialId,
                points: pointsUnderPath
            })
        }).then(response => {
            if (response.ok) {
                // reload  the page
                location.reload();
            } else {
                // hide progress - add d-none
                progress.classList.add('d-none');
                alert('Error saving data');
            }
        });
    });
});
