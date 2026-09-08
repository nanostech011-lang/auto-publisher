package com.autopublisher.application.port.out;

import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishResult;

import java.io.InputStream;
import java.util.Optional;

public interface SocialMediaPublisherPort {

    boolean supports(Platform platform);

    PublishResult publish(PostSchedule post, InputStream videoStream, Optional<InputStream> thumbnailStream);
}