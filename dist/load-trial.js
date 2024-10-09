"use strict";
// express middleware module to load a trial from the csv file
// and store it in the request object
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePointsAOIs = void 0;
exports.getSubjectAndTrialList = getSubjectAndTrialList;
exports.generateCSV = generateCSV;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const colors_1 = __importDefault(require("colors"));
const perf_hooks_1 = require("perf_hooks");
// setup sqlite3 database
function openDb() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = new better_sqlite3_1.default('./data/animalfeatures_points.db');
        db.pragma('journal_mode = WAL');
        // set cache to 1GB (in kibibytes)
        db.pragma('cache_size = -1000000');
        return db;
    });
}
let db;
// find all CSV files in the data directory
const availableCSVFiles = fs_1.default.readdirSync(path_1.default.join(__dirname, "../data")).filter((f) => f.endsWith('.csv') && !f.startsWith('animalfeatures_aois_out'));
// if none, error and exit
if (availableCSVFiles.length === 0) {
    console.error('\n\nERROR: No CSV files found in data directory!\n\n'.red);
    process.exit(1);
}
// if more than one, warn, and use first
if (availableCSVFiles.length > 1) {
    console.warn('\n\nWARNING: More than one CSV file found in data directory, using first one!\n\n'.red);
}
const csvPath = path_1.default.join(__dirname, "../data", availableCSVFiles[0]);
console.warn(colors_1.default.magenta("WARNING: Using csv file: %s\n\n"), csvPath);
function createDBSchema() {
    return __awaiter(this, void 0, void 0, function* () {
        db.exec("CREATE TABLE IF NOT EXISTS subjects (prolific_id TEXT PRIMARY KEY, condition TEXT, input_device TEXT, drawing_skills INTEGER)");
        db.exec("CREATE TABLE IF NOT EXISTS trials (prolific_id TEXT, trial INTEGER, animal TEXT, action TEXT, stim_img TEXT, drawing_time INTEGER, start_timestamp TEXT, end_timestamp TEXT, completed BOOLEAN, browser TEXT, browser_version TEXT, os TEXT, os_version TEXT, device TEXT, device_brand TEXT, device_model TEXT, window_width INTEGER, window_height INTEGER, orientation TEXT, aois_saved BOOLEAN)");
        db.exec("CREATE TABLE IF NOT EXISTS paths (prolific_id TEXT, trial INTEGER, path_id INTEGER)");
        db.exec("CREATE TABLE IF NOT EXISTS points (prolific_id TEXT, trial INTEGER, path_id INTEGER, point_id INTEGER, x INTEGER, y INTEGER, aoi TEXT)");
        // create indices
        db.exec("CREATE INDEX IF NOT EXISTS idx_subjects_prolific_id ON subjects(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_trials_prolific_id ON trials(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_trials_trial ON trials(trial)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_paths_prolific_id ON paths(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_paths_trial ON paths(trial)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_prolific_id ON points(prolific_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_trial ON points(trial)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_path_id ON points(path_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_points_point_id ON points(point_id)");
        // update AOIs set to 0 where null
        db.exec("UPDATE trials SET aois_saved = 0 WHERE aois_saved IS NULL");
    });
}
function loadCsv() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\t=> loading csv'.yellow);
        const subjects = {
            n: 0,
            ids: [],
        };
        return new Promise((resolve, reject) => {
            fs_1.default.createReadStream(csvPath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                const subjectId = data.prolific_id;
                if (!subjects[`s${subjectId}`]) {
                    subjects[`s${subjectId}`] = {
                        participant_code: data.participant_code,
                        prolific_id: data.prolific_id,
                        condition: data.condition,
                        input_device: data.input_device,
                        drawing_skills: data.drawing_skills,
                        n: 0,
                        trial_ids: [],
                    };
                    subjects.n++;
                    subjects.ids.push(`${subjectId}`);
                }
                const subject = subjects[`s${subjectId}`];
                const trialId = data.trial;
                if (!subject[trialId]) {
                    subject[trialId] = {
                        prolific_id: data.prolific_id,
                        trial: data.trial,
                        animal: data.animal,
                        action: data.action,
                        aois_saved: 0,
                        stim_img: data.stim_img,
                        drawing_time: data.drawing_time,
                        start_timestamp: data.start_timestamp,
                        end_timestamp: data.end_timestamp,
                        completed: data.completed,
                        browser: data.browser,
                        browser_version: data.browser_version,
                        os: data.os,
                        os_version: data.os_version,
                        device: data.device,
                        device_brand: data.device_brand,
                        device_model: data.device_model,
                        window_width: data.window_width,
                        window_height: data.window_height,
                        orientation: data.orientation,
                        n: 0,
                    };
                    subject.n++;
                    subject.trial_ids.push(trialId);
                }
                const trial = subject[trialId];
                const path_id = data.path_id;
                if (!trial[path_id]) {
                    trial[path_id] = {
                        prolific_id: data.prolific_id,
                        trial: data.trial,
                        path_id: data.path_id,
                        n: 0,
                    };
                    trial.n++;
                }
                const path = trial[path_id];
                const point = {
                    prolific_id: data.prolific_id,
                    trial: data.trial,
                    path_id: data.path_id,
                    x: data.x,
                    y: data.y,
                    point_id: data.point_id,
                    aoi: "",
                };
                path[data.point_id] = point;
                path.n++;
            })
                .on('end', () => {
                console.log('\t=> CSV file successfully processed'.yellow);
                resolve(subjects);
            });
        });
    });
}
let subjects = {
    n: 0,
    ids: [],
};
function addSubjects(subject) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("INSERT INTO subjects (prolific_id, condition, input_device, drawing_skills) VALUES (@prolific_id, @condition, @input_device, @drawing_skills)");
        const insertMany = db.transaction((subject) => {
            for (const s of subject) {
                stmt.run({
                    prolific_id: s.prolific_id,
                    condition: s.condition,
                    input_device: s.input_device,
                    drawing_skills: s.drawing_skills,
                });
            }
        });
        insertMany(subject);
    });
}
function addTrials(trial) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare(`INSERT INTO
            trials
                (
                    prolific_id,
                    trial,
                    animal,
                    action,
                    stim_img,
                    drawing_time,
                    start_timestamp,
                    end_timestamp,
                    completed,
                    browser,
                    browser_version,
                    os,
                    os_version,
                    device,
                    device_brand,
                    device_model,
                    window_width,
                    window_height,
                    orientation
                )
                VALUES 
                (
                    @prolific_id,
                    @trial,
                    @animal,
                    @action,
                    @stim_img,
                    @drawing_time,
                    @start_timestamp,
                    @end_timestamp,
                    @completed,
                    @browser,
                    @browser_version,
                    @os,
                    @os_version,
                    @device,
                    @device_brand,
                    @device_model,
                    @window_width,
                    @window_height,
                    @orientation
                )`);
        const insertMany = db.transaction((trial) => {
            for (const t of trial) {
                stmt.run({
                    prolific_id: t.prolific_id,
                    trial: t.trial,
                    animal: t.animal,
                    action: t.action,
                    stim_img: t.stim_img,
                    drawing_time: t.drawing_time,
                    start_timestamp: t.start_timestamp,
                    end_timestamp: t.end_timestamp,
                    completed: t.completed,
                    browser: t.browser,
                    browser_version: t.browser_version,
                    os: t.os,
                    os_version: t.os_version,
                    device: t.device,
                    device_brand: t.device_brand,
                    device_model: t.device_model,
                    window_width: t.window_width,
                    window_height: t.window_height,
                    orientation: t.orientation,
                });
            }
        });
        insertMany(trial);
    });
}
function addPath(paths) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("INSERT INTO paths (prolific_id, trial, path_id) VALUES (@prolific_id, @trial, @path_id)");
        const insertMany = db.transaction((paths) => {
            for (const p of paths) {
                stmt.run({ prolific_id: p.prolific_id, trial: p.trial, path_id: p.path_id });
            }
        });
        insertMany(paths);
    });
}
function addPoints(point) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("INSERT INTO points (prolific_id, trial, path_id, point_id, x, y, aoi) VALUES (@prolific_id, @trial, @path_id, @point_id, @x, @y, @aoi)");
        const insertMany = db.transaction((point) => {
            for (const p of point) {
                stmt.run({ prolific_id: p.prolific_id, trial: p.trial, path_id: p.path_id, point_id: p.point_id, x: p.x, y: p.y, aoi: p.aoi });
            }
        });
        insertMany(point);
    });
}
function buildSubjectsFromDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM subjects");
        const subjs = stmt.all();
        subjs.forEach((row) => {
            const subjectId = row.prolific_id;
            subjects[`s${subjectId}`] = {
                participant_code: row.participant_code,
                prolific_id: row.prolific_id,
                condition: row.condition,
                input_device: row.input_device,
                drawing_skills: row.drawing_skills,
                n: 0,
                trial_ids: [],
            };
            subjects.n++;
            subjects.ids.push(`${subjectId}`);
        });
    });
}
function buildTrialsFromDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM trials");
        const trials = stmt.all();
        trials.forEach((row) => {
            const subjectId = row.prolific_id;
            const trialId = row.trial;
            if (!subjects[`s${subjectId}`][trialId]) {
                subjects[`s${subjectId}`][trialId] = {
                    prolific_id: row.prolific_id,
                    trial: row.trial,
                    animal: row.animal,
                    action: row.action,
                    aois_saved: row.aois_saved,
                    stim_img: row.stim_img,
                    drawing_time: row.drawing_time,
                    start_timestamp: row.start_timestamp,
                    end_timestamp: row.end_timestamp,
                    completed: row.completed,
                    browser: row.browser,
                    browser_version: row.browser_version,
                    os: row.os,
                    os_version: row.os_version,
                    device: row.device,
                    device_brand: row.device_brand,
                    device_model: row.device_model,
                    window_width: row.window_width,
                    window_height: row.window_height,
                    orientation: row.orientation,
                    n: 0,
                };
                subjects[`s${subjectId}`].n++;
                subjects[`s${subjectId}`].trial_ids.push(trialId);
            }
        });
    });
}
function buildPathsFromDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM paths");
        const paths = stmt.all();
        paths.forEach((row) => {
            const subjectId = row.prolific_id;
            const trialId = row.trial;
            const pathId = row.path_id;
            if (!subjects[`s${subjectId}`][trialId][pathId]) {
                subjects[`s${subjectId}`][trialId][pathId] = {
                    prolific_id: row.prolific_id,
                    trial: row.trial,
                    path_id: row.path_id,
                    n: 0,
                };
                subjects[`s${subjectId}`][trialId].n++;
            }
        });
    });
}
function buildPointsFromDB() {
    return __awaiter(this, arguments, void 0, function* (force = false) {
        const stmt = db.prepare("SELECT * FROM points");
        const points = stmt.all();
        points.forEach((row) => {
            const subjectId = row.prolific_id;
            const trialId = row.trial;
            const pathId = row.path_id;
            const pointId = row.point_id;
            // console.log(subjectId, trialId, pathId, pointId);
            if (!subjects[`s${subjectId}`][trialId][pathId][pointId] || force) {
                subjects[`s${subjectId}`][trialId][pathId][pointId] = {
                    prolific_id: row.prolific_id,
                    trial: row.trial,
                    path_id: row.path_id,
                    x: row.x,
                    y: row.y,
                    point_id: row.point_id,
                    aoi: row.aoi,
                };
                subjects[`s${subjectId}`][trialId][pathId].n++;
            }
        });
    });
}
function buildPointsForTrialFromDB(prolific_id, trial) {
    return __awaiter(this, void 0, void 0, function* () {
        const stmt = db.prepare("SELECT * FROM points WHERE prolific_id = @prolific_id AND trial = @trial");
        const points = stmt.all({ prolific_id: prolific_id, trial: trial });
        const subject = subjects[`s${prolific_id}`];
        const t = subject[trial];
        const paths = {};
        for (const p of points) {
            const pathId = p.path_id;
            // if the path isn't in paths, we need to reset n
            if (!paths[pathId]) {
                paths[pathId] = true;
                t[pathId].n = 0;
            }
            const pointId = p.point_id;
            t[pathId][pointId] = {
                prolific_id: p.prolific_id,
                trial: p.trial,
                path_id: p.path_id,
                x: p.x,
                y: p.y,
                point_id: p.point_id,
                aoi: p.aoi,
            };
            t[pathId].n++;
        }
    });
}
openDb().then((database) => {
    db = database;
    console.log('db opened');
    console.warn('\n\nPlease wait, this might take a while...\n\n'.magenta);
    perf_hooks_1.performance.mark('schema_start');
    createDBSchema().then(() => {
        perf_hooks_1.performance.mark('schema_end');
        perf_hooks_1.performance.measure('schema', 'schema_start', 'schema_end');
        const measure = perf_hooks_1.performance.getEntriesByName('schema')[0];
        console.log(colors_1.default.yellow('\t=> db schema created in %s ms'), measure.duration);
        perf_hooks_1.performance.mark('build_subj_start');
        // first try to build the subjects from the database
        buildSubjectsFromDB().then(() => {
            perf_hooks_1.performance.mark('build_subj_end');
            perf_hooks_1.performance.measure('build_subj', 'build_subj_start', 'build_subj_end');
            const measure = perf_hooks_1.performance.getEntriesByName('build_subj')[0];
            console.log(colors_1.default.yellow('\t=> subjects built from db in %s ms'), measure.duration);
            perf_hooks_1.performance.mark('build_trials_start');
            buildTrialsFromDB().then(() => {
                perf_hooks_1.performance.mark('build_trials_end');
                perf_hooks_1.performance.measure('build_trials', 'build_trials_start', 'build_trials_end');
                const measure = perf_hooks_1.performance.getEntriesByName('build_trials')[0];
                console.log(colors_1.default.yellow('\t=> trials built from db in %s ms'), measure.duration);
                perf_hooks_1.performance.mark('build_paths_start');
                buildPathsFromDB().then(() => {
                    perf_hooks_1.performance.mark('build_paths_end');
                    perf_hooks_1.performance.measure('build_paths', 'build_paths_start', 'build_paths_end');
                    const measure = perf_hooks_1.performance.getEntriesByName('build_paths')[0];
                    console.log(colors_1.default.yellow('\t=> paths built from db in %s ms'), measure.duration);
                    perf_hooks_1.performance.mark('build_points_start');
                    buildPointsFromDB().then(() => {
                        perf_hooks_1.performance.mark('build_points_end');
                        perf_hooks_1.performance.measure('build_points', 'build_points_start', 'build_points_end');
                        const measure = perf_hooks_1.performance.getEntriesByName('build_points')[0];
                        console.log(colors_1.default.yellow('\t=> points built from db in %s ms'), measure.duration);
                        // if no subjects are found in the database, load them from the csv file
                        if (subjects.n === 0) {
                            console.log('\t=> no subjects found in db, loading from csv'.yellow);
                            perf_hooks_1.performance.mark('load_csv_start');
                            loadCsv().then((data) => {
                                perf_hooks_1.performance.mark('load_csv_end');
                                perf_hooks_1.performance.measure('load_csv', 'load_csv_start', 'load_csv_end');
                                const measure = perf_hooks_1.performance.getEntriesByName('load_csv')[0];
                                console.log(colors_1.default.yellow('\t=> subjects loaded from csv in %s ms'), measure.duration);
                                subjects = data;
                            }).then(() => {
                                const subjectArray = subjects.ids.map((id) => subjects[`s${id}`]);
                                perf_hooks_1.performance.mark('add_subj_start');
                                addSubjects(subjectArray).then(() => {
                                    perf_hooks_1.performance.mark('add_subj_end');
                                    perf_hooks_1.performance.measure('add_subj', 'add_subj_start', 'add_subj_end');
                                    const measure = perf_hooks_1.performance.getEntriesByName('add_subj')[0];
                                    console.log(colors_1.default.yellow('\t=> subjects added to db in %s ms'), measure.duration);
                                    const trialArray = subjects.ids.flatMap((id) => subjects[`s${id}`].trial_ids.map((tid) => subjects[`s${id}`][tid]));
                                    perf_hooks_1.performance.mark('add_trials_start');
                                    addTrials(trialArray).then(() => {
                                        perf_hooks_1.performance.mark('add_trials_end');
                                        perf_hooks_1.performance.measure('add_trials', 'add_trials_start', 'add_trials_end');
                                        const measure = perf_hooks_1.performance.getEntriesByName('add_trials')[0];
                                        console.log(colors_1.default.yellow('\t=> trials added to db in %s ms'), measure.duration);
                                        const pathArray = trialArray.flatMap((t) => Object.values(t).filter((p) => p.path_id !== undefined));
                                        perf_hooks_1.performance.mark('add_paths_start');
                                        addPath(pathArray).then(() => {
                                            perf_hooks_1.performance.mark('add_paths_end');
                                            perf_hooks_1.performance.measure('add_paths', 'add_paths_start', 'add_paths_end');
                                            const measure = perf_hooks_1.performance.getEntriesByName('add_paths')[0];
                                            console.log(colors_1.default.yellow('\t=> paths added to db in %s ms'), measure.duration);
                                            // we know the numeric keys are the points
                                            const pointArray = pathArray.flatMap((p) => Object.values(p).filter((p) => p.x !== undefined));
                                            perf_hooks_1.performance.mark('add_points_start');
                                            addPoints(pointArray).then(() => {
                                                perf_hooks_1.performance.mark('add_points_end');
                                                perf_hooks_1.performance.measure('add_points', 'add_points_start', 'add_points_end');
                                                const measure = perf_hooks_1.performance.getEntriesByName('add_points')[0];
                                                console.log(colors_1.default.yellow('\t=> points added to db in %s ms'), measure.duration);
                                            }).then(() => {
                                                console.log('\n\nserver is ready:'.green);
                                                console.log('http://localhost:3000'.green.underline);
                                                console.log('\n\n');
                                            });
                                        });
                                    });
                                });
                            });
                        }
                        else {
                            console.log('\t=> subjects found in db, skipping csv load'.yellow);
                            console.log('\n\nserver is ready:'.green);
                            console.log('http://localhost:3000'.green.underline);
                            console.log('\n\n');
                        }
                    });
                });
            });
        });
    });
});
const getTrial = (req, res, next) => {
    const subjectId = req.params.subjectId;
    const trialId = parseInt(req.params.trialId);
    perf_hooks_1.performance.mark('get_trial_start');
    if (subjects[`s${subjectId}`]) {
        const subject = subjects[`s${subjectId}`];
        const trial = subject[trialId];
        if (trial) {
            // set next trial and / or subject
            let nextSubjectId = subjectId;
            // get the next trial from subject.trial_ids
            const nextTrialIndex = subject.trial_ids.indexOf(trialId) + 1;
            if (nextTrialIndex < subject.trial_ids.length) {
                req.params.nextTrialId = `${subject.trial_ids[nextTrialIndex]}`;
            }
            else {
                // get the next subject
                const nextSubjectIndex = subjects.ids.indexOf(subjectId) + 1;
                if (nextSubjectIndex < subjects.ids.length) {
                    nextSubjectId = subjects.ids[nextSubjectIndex];
                    req.params.nextTrialId = `${subjects[`s${nextSubjectId}`].trial_ids[0]}`;
                }
                else {
                    nextSubjectId = "";
                    req.params.nextTrialId = "";
                }
            }
            req.params.nextSubjectId = nextSubjectId;
            console.log(colors_1.default.green('Found trial for subject: %s, trial: %s'), subjectId, trialId);
            req.params.trial = JSON.stringify(trial);
            req.params.subject = JSON.stringify(subject);
            req.params.svgPaths = svgPathsFromTrial(trial);
            req.params.subjectList = JSON.stringify(subjectList());
            perf_hooks_1.performance.mark('get_trial_end');
            perf_hooks_1.performance.measure('get_trial', 'get_trial_start', 'get_trial_end');
            const measure = perf_hooks_1.performance.getEntriesByName('get_trial')[0];
            console.log(colors_1.default.yellow('\t=> trial loaded in %s ms'), measure.duration);
            next();
        }
        else {
            console.log(colors_1.default.red('Trial not found for subject: %s, trial: %s'), subjectId, trialId);
            res.status(404).send('Trial not found');
        }
    }
    else {
        console.log(colors_1.default.red('Subject not found: %s'), subjectId);
        res.status(404).send('Subject not found');
    }
};
const aoiColors = {
    "head": "red",
    "torso": "blue",
    "legs": "green",
    "": "black",
};
const svgPathsFromTrial = (trial, strokeWidth = 2, strokeColor = "black", fillColor = "none") => {
    const n_paths = trial.n;
    let svgPaths = "";
    perf_hooks_1.performance.mark('svg_paths_start');
    let totalPoints = 0;
    let totalPaths = 0;
    const pathTemplate = (pointString, strokeColor = "black", aoi = "") => `<path d="${pointString}" stroke="${strokeColor}" stroke-linecap="round" stroke-width="${strokeWidth}" fill="${fillColor}" data-aoi="${aoi}" />`;
    for (let i = 1; i <= n_paths; i++) {
        totalPaths++;
        const path = trial[i];
        const n_points = path.n;
        let pointArray = [];
        let currentAoi = "";
        for (let j = 1; j <= n_points; j++) {
            totalPoints++;
            if (j === 1 || path[j].aoi !== currentAoi) {
                currentAoi = path[j].aoi;
                pointArray.push({ d: `M${path[j].x} ${path[j].y}`, aoi: currentAoi });
            }
            else {
                // add to "d" of the last point
                pointArray[pointArray.length - 1].d += ` L${path[j].x} ${path[j].y}`;
            }
        }
        for (const p of pointArray) {
            svgPaths += pathTemplate(p.d, aoiColors[p.aoi], p.aoi);
        }
    }
    perf_hooks_1.performance.mark('svg_paths_end');
    perf_hooks_1.performance.measure('svg_paths', 'svg_paths_start', 'svg_paths_end');
    const measure = perf_hooks_1.performance.getEntriesByName('svg_paths')[0];
    console.log(colors_1.default.yellow('\t=> %d svg paths generated with %d points in %s ms'), totalPaths, totalPoints, measure.duration);
    return svgPaths;
};
const savePointsAOIs = (req, res, next) => {
    const points = req.body.points;
    const prolific_id = req.body.prolific_id;
    const trial = req.body.trial;
    perf_hooks_1.performance.mark('reset_points_start');
    // reset ALL point AOIs for this trial
    console.log(colors_1.default.yellow('resetting all points for trial: %s for subject %s ...'), trial, prolific_id);
    const resetstmt = db.prepare("UPDATE points SET aoi = '' WHERE prolific_id = @prolific_id AND trial = @trial");
    resetstmt.run({ prolific_id: prolific_id, trial: trial });
    perf_hooks_1.performance.mark('reset_points_end');
    perf_hooks_1.performance.measure('reset_points', 'reset_points_start', 'reset_points_end');
    const measure = perf_hooks_1.performance.getEntriesByName('reset_points')[0];
    console.log(colors_1.default.yellow('\t=> points reset in %s ms'), measure.duration);
    console.log('saving points'.yellow);
    perf_hooks_1.performance.mark('save_points_start');
    let totalPoints = 0;
    const stmt = db.prepare("UPDATE points SET aoi = @aoi WHERE prolific_id = @prolific_id AND trial = @trial AND path_id = @path_id AND point_id = @point_id");
    const updateMany = db.transaction((points) => {
        for (const p of points) {
            totalPoints++;
            stmt.run({ prolific_id: prolific_id, trial: parseInt(trial), path_id: p.path_id, point_id: p.point_id, aoi: p.aoi });
        }
    });
    updateMany(points);
    perf_hooks_1.performance.mark('save_points_end');
    perf_hooks_1.performance.measure('save_points', 'save_points_start', 'save_points_end');
    const measure2 = perf_hooks_1.performance.getEntriesByName('save_points')[0];
    console.log(colors_1.default.yellow('\t=> %d points saved in %s ms'), totalPoints, measure2.duration);
    console.log('points saved, rebuilding cache'.green);
    perf_hooks_1.performance.mark('rebuild_cache_start');
    buildPointsForTrialFromDB(prolific_id, trial).then(() => {
        perf_hooks_1.performance.mark('rebuild_cache_end');
        perf_hooks_1.performance.measure('rebuild_cache', 'rebuild_cache_start', 'rebuild_cache_end');
        const measure = perf_hooks_1.performance.getEntriesByName('rebuild_cache')[0];
        console.log(colors_1.default.green('\t=> cache rebuilt in %s ms'), measure.duration);
    });
    console.log('marking trial as having AOIs saved'.yellow);
    perf_hooks_1.performance.mark('mark_trial_start');
    const updatestmt = db.prepare("UPDATE trials SET aois_saved = 1 WHERE prolific_id = @prolific_id AND trial = @trial");
    updatestmt.run({ prolific_id: prolific_id, trial: trial });
    perf_hooks_1.performance.mark('mark_trial_end');
    perf_hooks_1.performance.measure('mark_trial', 'mark_trial_start', 'mark_trial_end');
    const measure3 = perf_hooks_1.performance.getEntriesByName('mark_trial')[0];
    console.log(colors_1.default.green('\t=> trial marked as having AOIs saved in %s ms'), measure3.duration);
    // update the subject cache
    subjects[`s${prolific_id}`][trial].aois_saved = 1;
    next();
};
exports.savePointsAOIs = savePointsAOIs;
function subjectList() {
    // just return a nested array of subject ids and trial ids and aois_saved
    // if all of a subject's trials have aois_saved, then the subject is marked as complete
    const subjectsTrials = [];
    for (const s of subjects.ids) {
        const subject = subjects[`s${s}`];
        const subjectTrials = [];
        let complete = true;
        let completed = 0;
        for (const t of subject.trial_ids) {
            const trial = subject[t];
            subjectTrials.push({ trial: t, aois_saved: trial.aois_saved });
            if (trial.aois_saved === 0) {
                complete = false;
            }
            else {
                completed++;
            }
            // console.log(s, t, trial.aois_saved, complete);
        }
        subjectsTrials.push({ subject: s, trials: subjectTrials, complete: complete, partial: completed > 0 });
    }
    return subjectsTrials;
}
function getSubjectAndTrialList(req, res, next) {
    req.params.subjectList = JSON.stringify(subjectList());
    next();
}
function generateCSV(req, res, next) {
    const csv = require('csv-writer').createObjectCsvWriter;
    const file_date_time = new Date().toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
    const filename = `data/animalfeatures_aois_out_${file_date_time}.csv`;
    console.log(colors_1.default.yellow('generating csv file: %s'), filename);
    perf_hooks_1.performance.mark('generate_csv_start');
    const csvWriter = csv({
        path: filename,
        header: [
            { id: 'prolific_id', title: 'Prolific ID' },
            { id: 'trial', title: 'Trial' },
            { id: 'path_id', title: 'Path ID' },
            { id: 'point_id', title: 'Point ID' },
            { id: 'x', title: 'X' },
            { id: 'y', title: 'Y' },
            { id: 'aoi', title: 'AOI' },
        ]
    });
    const data = [];
    for (const s of subjects.ids) {
        const subject = subjects[`s${s}`];
        for (const t of subject.trial_ids) {
            const trial = subject[t];
            for (let i = 1; i <= trial.n; i++) {
                const path = trial[i];
                for (let j = 1; j <= path.n; j++) {
                    const point = path[j];
                    data.push({
                        prolific_id: subject.prolific_id,
                        trial: trial.trial,
                        path_id: path.path_id,
                        point_id: point.point_id,
                        x: point.x,
                        y: point.y,
                        aoi: point.aoi,
                    });
                }
            }
        }
    }
    csvWriter.writeRecords(data).then(() => {
        perf_hooks_1.performance.mark('generate_csv_end');
        perf_hooks_1.performance.measure('generate_csv', 'generate_csv_start', 'generate_csv_end');
        const measure = perf_hooks_1.performance.getEntriesByName('generate_csv')[0];
        console.log(colors_1.default.green('\t=> csv generated in %s ms'), measure.duration);
    });
    next();
}
exports.default = getTrial;
