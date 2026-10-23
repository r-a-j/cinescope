package com.rajcinescope.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeBackup")
public class NativeBackupPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");

        if (filename == null || filename.trim().isEmpty()) {
            call.reject("Missing filename");
            return;
        }

        if (content == null) {
            call.reject("Missing backup content");
            return;
        }

        new Thread(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                contentValues.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 1);

                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
                    if (uri == null) {
                        call.reject("Could not create MediaStore entry in Downloads");
                        return;
                    }

                    try (OutputStream os = resolver.openOutputStream(uri)) {
                        if (os != null) {
                            os.write(content.getBytes(StandardCharsets.UTF_8));
                            os.flush();
                        }
                    }

                    contentValues.clear();
                    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    resolver.update(uri, contentValues, null, null);

                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("filePath", "Download/" + filename);
                    call.resolve(res);
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File targetFile = new File(downloadsDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }

                    MediaScannerConnection.scanFile(
                        getContext(),
                        new String[]{targetFile.getAbsolutePath()},
                        new String[]{"application/json"},
                        null
                    );

                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("filePath", "Download/" + filename);
                    call.resolve(res);
                }
            } catch (Exception e) {
                call.reject("Failed to save backup to Downloads: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String filename = call.getString("filename", "cinescope-backup.json");
        String content = call.getString("content");
        String title = call.getString("title", "CineScope Backup");

        if (content == null) {
            call.reject("Missing backup content");
            return;
        }

        new Thread(() -> {
            try {
                File cacheDir = new File(getContext().getCacheDir(), "backups");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }
                File backupFile = new File(cacheDir, filename);
                try (FileOutputStream fos = new FileOutputStream(backupFile)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }

                Uri fileUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    backupFile
                );

                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("application/json");
                sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                sendIntent.putExtra(Intent.EXTRA_TEXT, "CineScope Library Backup (" + filename + ")");
                sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(sendIntent, title);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(chooser);

                JSObject res = new JSObject();
                res.put("success", true);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Failed to share backup file: " + e.getMessage(), e);
            }
        }).start();
    }
}
