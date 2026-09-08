package com.autopublisher.application.port.out;

import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduleRepositoryPort {

    List<PostSchedule> findPendingPostsDue(LocalDateTime referenceTime);

    List<PostSchedule> findAllPosts();

    void appendPost(PostSchedule post);

    void updateStatus(int rowIndex, PublishStatus status, String publishedUrl, String logMessage, int attempts);
}