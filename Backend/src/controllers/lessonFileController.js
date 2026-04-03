// src/controllers/lessonFileController.js
const db = require('../config/db');
const drive = require('../config/googleDrive');
const { Readable } = require('stream');
const https = require('https');
const http = require('http');

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// ── In-memory folder ID cache ─────────────────────────────────────────────
// Key: 'parentId::folderName'  Value: Drive folder ID
// Lives for the lifetime of the Node process — fast, no DB needed.
const folderCache = new Map();

// Helper: sanitize a string so it's safe as a Drive folder name
function safeName(str) {
    return String(str)
        .replace(/[/\\:*?"<>|]/g, '_')   // remove filename-unsafe chars
        .replace(/\s+/g, '_')             // spaces → underscores
        .slice(0, 80);                    // Drive name limit safety
}

// Helper: find an existing folder OR create it, returning its Drive ID.
// Results are cached so repeated uploads to the same lesson cost 0 extra calls.
async function getOrCreateFolder(parentId, folderName) {
    const cacheKey = `${parentId}::${folderName}`;
    if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

    // Search Drive for an existing folder with this name under parentId
    const listRes = await drive.files.list({
        q: [
            `name='${folderName}'`,
            `'${parentId}' in parents`,
            `mimeType='application/vnd.google-apps.folder'`,
            `trashed=false`,
        ].join(' and '),
        fields: 'files(id)',
        spaces: 'drive',
    });

    if (listRes.data.files.length > 0) {
        const id = listRes.data.files[0].id;
        folderCache.set(cacheKey, id);
        return id;
    }

    // Folder doesn't exist — create it
    const createRes = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
    });

    const id = createRes.data.id;
    folderCache.set(cacheKey, id);
    return id;
}

// Helper: convert a Buffer to a readable stream
function bufferToStream(buffer) {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    return readable;
}

// Helper: extract Google Drive file ID from a stored URL
// Supports two URL formats:
//   https://drive.google.com/uc?export=view&id=FILE_ID
//   https://drive.google.com/file/d/FILE_ID/view
function extractDriveFileId(url) {
    if (!url) return null;
    try {
        // Format: ?id=FILE_ID
        const idParam = new URL(url).searchParams.get('id');
        if (idParam) return idParam;
        // Format: /file/d/FILE_ID/
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// GET /api/lesson-files/:lessonId — list all files for a lesson
const getFilesByLesson = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lessonId } = req.params;

        const result = await db.query(
            `SELECT * FROM lesson_files
             WHERE lesson_id = $1 AND user_id = $2
             ORDER BY created_at ASC`,
            [lessonId, userId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getFilesByLesson:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/lesson-files/upload — upload a file to Google Drive
const uploadFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lesson_id } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }
        if (!lesson_id) {
            return res.status(400).json({ message: 'lesson_id is required' });
        }

        // ── Resolve user name + lesson title for folder naming ──────────
        const [userRow, lessonRow] = await Promise.all([
            db.query('SELECT full_name FROM users WHERE id = $1', [userId]),
            db.query('SELECT title FROM lessons WHERE id = $1', [lesson_id]),
        ]);

        const userName   = userRow.rows[0]?.full_name  || `user_${userId}`;
        const lessonTitle = lessonRow.rows[0]?.title    || `lesson_${lesson_id}`;

        // Folder names: e.g. "user_7_Kareem_Ismail" / "lesson_3_Programming"
        const userFolderName   = safeName(`user_${userId}_${userName}`);
        const lessonFolderName = safeName(`lesson_${lesson_id}_${lessonTitle}`);

        // ── Get or create the nested folder structure ────────────────────
        //   ROOT  →  user folder  →  lesson folder
        const userFolderId   = await getOrCreateFolder(ROOT_FOLDER_ID, userFolderName);
        const lessonFolderId = await getOrCreateFolder(userFolderId, lessonFolderName);

        // ── Upload the file into the lesson folder ───────────────────────
        const { originalname, mimetype, buffer } = req.file;
        const driveFileName = `${Date.now()}_${safeName(originalname)}`;

        const driveResponse = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [lessonFolderId],
                mimeType: mimetype,
            },
            media: {
                mimeType: mimetype,
                body: bufferToStream(buffer),
            },
            fields: 'id',
        });

        const fileId = driveResponse.data.id;

        // Make the file publicly readable (anyone with the link)
        await drive.permissions.create({
            fileId,
            requestBody: { role: 'reader', type: 'anyone' },
        });

        const file_path = `https://drive.google.com/uc?export=view&id=${fileId}`;

        const result = await db.query(
            `INSERT INTO lesson_files (lesson_id, user_id, type, name, file_path)
             VALUES ($1, $2, 'upload', $3, $4) RETURNING *`,
            [lesson_id, userId, originalname, file_path]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in uploadFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/lesson-files — create a name-only record (AI-generated video/audio)
const createRecord = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lesson_id, type, name, file_path } = req.body;

        if (!lesson_id || !type || !name) {
            return res.status(400).json({ message: 'lesson_id, type, and name are required' });
        }

        const result = await db.query(
            `INSERT INTO lesson_files (lesson_id, user_id, type, name, file_path)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [lesson_id, userId, type, name, file_path || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createRecord:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// PUT /api/lesson-files/:id — rename a file record
const renameFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'name is required' });
        }

        const result = await db.query(
            `UPDATE lesson_files SET name = $1
             WHERE id = $2 AND user_id = $3 RETURNING *`,
            [name.trim(), id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in renameFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// DELETE /api/lesson-files/:id — delete record and remove file from Google Drive
const deleteFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Fetch the record first to get the file_path
        const existing = await db.query(
            'SELECT * FROM lesson_files WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const record = existing.rows[0];

        // Delete from DB first
        await db.query('DELETE FROM lesson_files WHERE id = $1', [id]);

        // Delete from Google Drive if URL present
        if (record.file_path && record.file_path.includes('drive.google.com')) {
            const fileId = extractDriveFileId(record.file_path);
            if (fileId) {
                try {
                    await drive.files.delete({ fileId });
                } catch (driveErr) {
                    console.error('Google Drive delete error (non-fatal):', driveErr.message);
                }
            }
        }

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error in deleteFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// GET /api/lesson-files/download/:id — proxy download with correct filename
const downloadFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM lesson_files WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const record = result.rows[0];
        if (!record.file_path) {
            return res.status(404).json({ message: 'No file available' });
        }

        // For Google Drive URLs: use export=download for forced download
        let downloadUrl = record.file_path;
        const driveFileId = extractDriveFileId(record.file_path);
        if (driveFileId) {
            downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
        }

        const filename = record.name || 'download';
        const safeFilename = encodeURIComponent(filename);

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${safeFilename}`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Stream the file to the client
        const protocol = downloadUrl.startsWith('https') ? https : http;
        protocol.get(downloadUrl, (fileRes) => {
            // Follow redirects (Drive download redirects once)
            if (fileRes.statusCode === 302 || fileRes.statusCode === 301) {
                const redirectUrl = fileRes.headers.location;
                https.get(redirectUrl, (redirectRes) => {
                    redirectRes.pipe(res);
                }).on('error', (err) => {
                    console.error('Redirect download error:', err.message);
                    if (!res.headersSent) res.status(500).json({ message: 'Failed to download file' });
                });
            } else {
                fileRes.pipe(res);
            }
        }).on('error', (err) => {
            console.error('Proxy download error:', err.message);
            if (!res.headersSent) res.status(500).json({ message: 'Failed to download file' });
        });

    } catch (error) {
        console.error('Error in downloadFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// ── streamFile — inline stream for <video> / <audio> playback ───────────────
// Serves the file without Content-Disposition so the browser plays it inline.
// Supports Range requests (required for video seeking / audio scrubbing).
const streamFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM lesson_files WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'File not found' });

        const record = result.rows[0];
        if (!record.file_path) return res.status(204).end(); // no file yet

        // Extract Drive file ID from stored URL
        let driveFileId;
        try {
            driveFileId = new URL(record.file_path).searchParams.get('id');
        } catch { /* not a URL */ }
        if (!driveFileId) {
            const m = record.file_path.match(/\/d\/([a-zA-Z0-9_-]+)/);
            driveFileId = m ? m[1] : null;
        }
        if (!driveFileId) return res.status(400).json({ message: 'Cannot determine Drive file ID' });

        const streamUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

        // Content-Type by record type
        const contentTypes = { video: 'video/mp4', audio: 'audio/mpeg', upload: 'application/octet-stream' };
        res.setHeader('Content-Type', contentTypes[record.type] || 'application/octet-stream');
        res.setHeader('Accept-Ranges', 'bytes');

        const rangeHeader = req.headers.range;
        const reqOptions = rangeHeader ? { headers: { Range: rangeHeader } } : {};

        const doStream = (url, options) => {
            https.get(url, options, (upstream) => {
                if (upstream.statusCode === 301 || upstream.statusCode === 302) {
                    return doStream(upstream.headers.location, options);
                }
                if (upstream.headers['content-length'])
                    res.setHeader('Content-Length', upstream.headers['content-length']);
                if (upstream.headers['content-range'])
                    res.setHeader('Content-Range', upstream.headers['content-range']);
                res.status(upstream.statusCode === 206 ? 206 : 200);
                upstream.pipe(res);
            }).on('error', (err) => {
                console.error('Stream error:', err.message);
                if (!res.headersSent) res.status(500).json({ message: 'Stream failed' });
            });
        };

        doStream(streamUrl, reqOptions);

    } catch (error) {
        console.error('Error in streamFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getFilesByLesson,
    uploadFile,
    createRecord,
    renameFile,
    deleteFile,
    downloadFile,
    streamFile,
};

