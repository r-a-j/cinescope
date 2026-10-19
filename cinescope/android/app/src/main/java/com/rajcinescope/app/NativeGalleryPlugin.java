package com.rajcinescope.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "NativeGallery")
public class NativeGalleryPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String urlString = call.getString("url");
        String filename = call.getString("filename", "cinescope_portrait_" + System.currentTimeMillis() + ".jpg");

        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing image url");
            return;
        }

        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setDoInput(true);
                connection.connect();

                InputStream input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                input.close();

                if (bitmap == null) {
                    call.reject("Could not decode downloaded image");
                    return;
                }

                ContentResolver resolver = getContext().getContentResolver();
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                contentValues.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    contentValues.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/CineScope");
                    contentValues.put(MediaStore.Images.Media.IS_PENDING, 1);
                }

                Uri imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);
                if (imageUri == null) {
                    call.reject("Could not create MediaStore entry");
                    return;
                }

                OutputStream outStream = resolver.openOutputStream(imageUri);
                if (outStream != null) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 95, outStream);
                    outStream.close();
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    contentValues.clear();
                    contentValues.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(imageUri, contentValues, null, null);
                }

                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{imageUri.getPath()},
                    new String[]{"image/jpeg"},
                    null
                );

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("uri", imageUri.toString());
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Failed to save image: " + e.getMessage(), e);
            }
        }).start();
    }
}
