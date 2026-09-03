package com.autopublisher.application.port.in;

import com.autopublisher.domain.model.PostSchedule;

import java.util.List;

/**
 * DTO imutavel que agrega os dados de visao geral para o Dashboard do usuario.
 */
public record DashboardOverview(
        List<PostSchedule> posts,
        int totalPosts,
        int pendingPosts,
        int publishedPosts,
        int errorPosts,
        YouTubeQuotaOverview youtubeQuota
) {
    public record YouTubeQuotaOverview(
            int publishedToday,
            int maxDailyVideos,
            int consumedUnits,
            int totalDailyUnits,
            double percentageConsumed,
            boolean isQuotaExceeded
    ) {
        public static YouTubeQuotaOverview of(int publishedToday) {
            int maxDaily = 6;
            int unitCost = 1650;
            int totalUnits = 10000;
            int consumed = publishedToday * unitCost;
            double percentage = Math.min(100.0, ((double) consumed / totalUnits) * 100.0);
            boolean exceeded = consumed >= totalUnits || publishedToday >= maxDaily;
            return new YouTubeQuotaOverview(publishedToday, maxDaily, consumed, totalUnits, percentage, exceeded);
        }
    }
}
