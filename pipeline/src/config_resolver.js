import fs from 'fs';
import path from 'path';

/**
 * Esquema canônico de validação e resolução de perfis de canais
 */
export function resolveChannelConfig(channelId = 'custom', customProfile = null) {
  let profile = customProfile;

  if (!profile) {
    const profilePath = path.resolve(`pipeline/config/channels/${channelId}.json`);
    if (fs.existsSync(profilePath)) {
      try {
        profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      } catch (err) {
        throw new Error(`[ConfigResolver] Falha ao parsear JSON de configuração do canal "${channelId}": ${err.message}`);
      }
    }
  }

  if (!profile) {
    // Retorna template padrão para canais dinâmicos/customizados
    profile = {
      channel_id: channelId,
      name: `@${channelId}`,
      niche: 'Geral',
      format: {
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        target_fps: 30,
        target_duration_seconds: 62,
        cuts_interval_seconds: '2-4'
      },
      voice_profile: {
        provider: 'edge_tts',
        voice_id: 'pt-BR-AntonioNeural',
        rate: '+2%',
        pitch: '+0Hz'
      },
      visual_profile: {
        aesthetic: 'Cinematic Dark Minimalist',
        subtitles_style: {
          font_name: 'Montserrat-Black',
          font_size: 65,
          primary_color: '&H00FFFFFF',
          active_word_color: '&H0000D7FF',
          outline_color: '&H00000000',
          outline_width: 4,
          margin_v: 560
        }
      },
      publishing_profile: {
        platforms: ['YOUTUBE_SHORTS', 'TIKTOK', 'INSTAGRAM_REELS'],
        made_for_kids: false,
        privacy: 'PUBLIC',
        default_tags: ['shorts', 'viral', channelId],
        affiliate_cta: {
          description_template: '👉 Acesse o link oficial para saber mais: https://meulink.com',
          first_comment: 'Link oficial fixado no primeiro comentário!'
        }
      }
    };
  }

  // Validação Fail-Fast de Integridade Estrutural
  validateChannelProfile(profile);

  return profile;
}

/**
 * Validação rigorosa de campos obrigatórios e invariantes de segurança
 */
export function validateChannelProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('[ConfigResolver] Perfil do canal deve ser um objeto válido.');
  }

  if (!profile.channel_id || typeof profile.channel_id !== 'string') {
    throw new Error('[ConfigResolver] "channel_id" é obrigatório e deve ser uma string.');
  }

  // Valida formato
  if (profile.format) {
    if (profile.format.resolution && !/^\d+x\d+$/.test(profile.format.resolution)) {
      throw new Error(`[ConfigResolver] Resolução inválida: "${profile.format.resolution}". Esperado formato "LARGURAxALTURA" (ex: 1080x1920).`);
    }
  }

  // Valida safe area de legendas se especificado
  const marginV = profile.visual_profile?.subtitles_style?.margin_v;
  if (typeof marginV === 'number' && marginV < 450) {
    console.warn(`[ConfigResolver] ⚠️ AVISO: margin_v (${marginV}) está abaixo de 450. Pode haver sobreposição com a UI mobile do YouTube Shorts / TikTok.`);
  }

  // Valida COPPA
  if (profile.publishing_profile && profile.publishing_profile.made_for_kids === true) {
    console.warn(`[ConfigResolver] ⚠️ ATENÇÃO: Canal configurado com made_for_kids: true. Anúncios personalizados e comentários estarão desabilitados.`);
  }

  return true;
}
