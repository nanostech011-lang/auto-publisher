package com.autopublisher.application.port.out;

import java.io.InputStream;

public interface MediaStoragePort {

    InputStream downloadMediaStream(String fileId);

    long getFileSize(String fileId);
}