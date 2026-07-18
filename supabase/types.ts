export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      banned_participants: {
        Row: {
          author_name: string | null
          banned_by: string
          channel_id: string
          created_at: string
          external_author_id: string | null
          id: string
          origin: string
          participant_key: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          author_name?: string | null
          banned_by?: string
          channel_id: string
          created_at?: string
          external_author_id?: string | null
          id?: string
          origin?: string
          participant_key: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          author_name?: string | null
          banned_by?: string
          channel_id?: string
          created_at?: string
          external_author_id?: string | null
          id?: string
          origin?: string
          participant_key?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banned_participants_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          avatar_path: string | null
          banner_path: string | null
          created_at: string
          description: string
          handle: string
          id: string
          name: string
          owner_user_id: string
          slug: string
        }
        Insert: {
          avatar_path?: string | null
          banner_path?: string | null
          created_at?: string
          description?: string
          handle: string
          id?: string
          name: string
          owner_user_id: string
          slug: string
        }
        Update: {
          avatar_path?: string | null
          banner_path?: string | null
          created_at?: string
          description?: string
          handle?: string
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string
        }
        Relationships: []
      }
      chat_commands: {
        Row: {
          builtin_key: string | null
          channel_id: string
          cooldown_s: number
          created_at: string
          description: string
          enabled: boolean
          id: string
          keyword: string
          kind: string
          max_per_stream: number | null
          response: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          builtin_key?: string | null
          channel_id: string
          cooldown_s?: number
          created_at?: string
          description: string
          enabled?: boolean
          id?: string
          keyword: string
          kind: string
          max_per_stream?: number | null
          response?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          builtin_key?: string | null
          channel_id?: string
          cooldown_s?: number
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          keyword?: string
          kind?: string
          max_per_stream?: number | null
          response?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_commands_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          body: string
          created_at: string
          external_author_id: string | null
          external_message_id: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          origin: string
          stream_id: string
          user_id: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          external_author_id?: string | null
          external_message_id?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          origin?: string
          stream_id: string
          user_id?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          external_author_id?: string | null
          external_message_id?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          origin?: string
          stream_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_scoring_state: {
        Row: {
          auto_display_featured: boolean
          enabled: boolean
          highlighting_enabled: boolean
          last_scored_at: string | null
          locked_until: string | null
          moderation_mode: string
          stream_id: string
          tts_mode: string
          updated_at: string
        }
        Insert: {
          auto_display_featured?: boolean
          enabled?: boolean
          highlighting_enabled?: boolean
          last_scored_at?: string | null
          locked_until?: string | null
          moderation_mode?: string
          stream_id: string
          tts_mode?: string
          updated_at?: string
        }
        Update: {
          auto_display_featured?: boolean
          enabled?: boolean
          highlighting_enabled?: boolean
          last_scored_at?: string | null
          locked_until?: string | null
          moderation_mode?: string
          stream_id?: string
          tts_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_scoring_state_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: true
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      chatter_stats: {
        Row: {
          author_channel_id: string
          author_name: string | null
          first_seen_at: string | null
          last_seen_at: string | null
          total_messages: number
          updated_at: string
          videos_attended: number
        }
        Insert: {
          author_channel_id: string
          author_name?: string | null
          first_seen_at?: string | null
          last_seen_at?: string | null
          total_messages?: number
          updated_at?: string
          videos_attended?: number
        }
        Update: {
          author_channel_id?: string
          author_name?: string | null
          first_seen_at?: string | null
          last_seen_at?: string | null
          total_messages?: number
          updated_at?: string
          videos_attended?: number
        }
        Relationships: []
      }
      command_events: {
        Row: {
          args: string | null
          channel_id: string
          chat_message_id: string | null
          created_at: string
          id: string
          keyword: string
          origin: string
          participant_key: string
          reply: string | null
          status: string
          stream_id: string
        }
        Insert: {
          args?: string | null
          channel_id: string
          chat_message_id?: string | null
          created_at?: string
          id?: string
          keyword: string
          origin: string
          participant_key: string
          reply?: string | null
          status: string
          stream_id: string
        }
        Update: {
          args?: string | null
          channel_id?: string
          chat_message_id?: string | null
          created_at?: string
          id?: string
          keyword?: string
          origin?: string
          participant_key?: string
          reply?: string | null
          status?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_events_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_events_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
          value: number
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
          value: number
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_layouts: {
        Row: {
          channel_id: string
          config: Json
          updated_at: string
        }
        Insert: {
          channel_id: string
          config?: Json
          updated_at?: string
        }
        Update: {
          channel_id?: string
          config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_layouts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_messages: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          body: string | null
          categories: string[]
          chat_message_id: string | null
          external_author_id: string | null
          featured_at: string
          id: string
          origin: string
          promoted_at: string | null
          reason: string | null
          ring_level: number
          score: number
          stream_id: string
          user_id: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string | null
          categories?: string[]
          chat_message_id?: string | null
          external_author_id?: string | null
          featured_at?: string
          id?: string
          origin?: string
          promoted_at?: string | null
          reason?: string | null
          ring_level?: number
          score: number
          stream_id: string
          user_id?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string | null
          categories?: string[]
          chat_message_id?: string | null
          external_author_id?: string | null
          featured_at?: string
          id?: string
          origin?: string
          promoted_at?: string | null
          reason?: string | null
          ring_level?: number
          score?: number
          stream_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_messages_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: true
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      me_profiles: {
        Row: {
          generated_at: string
          profile: string
          profile_key: string
          snapshot: Json
        }
        Insert: {
          generated_at?: string
          profile: string
          profile_key: string
          snapshot: Json
        }
        Update: {
          generated_at?: string
          profile?: string
          profile_key?: string
          snapshot?: Json
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          author_name: string | null
          chat_message_id: string | null
          created_at: string
          decided_at: string | null
          external_author_id: string | null
          id: string
          origin: string | null
          participant_key: string | null
          reason: string | null
          source: string
          status: string
          stream_id: string
          target_kind: string
          user_id: string | null
        }
        Insert: {
          action: string
          author_name?: string | null
          chat_message_id?: string | null
          created_at?: string
          decided_at?: string | null
          external_author_id?: string | null
          id?: string
          origin?: string | null
          participant_key?: string | null
          reason?: string | null
          source: string
          status?: string
          stream_id: string
          target_kind: string
          user_id?: string | null
        }
        Update: {
          action?: string
          author_name?: string | null
          chat_message_id?: string | null
          created_at?: string
          decided_at?: string | null
          external_author_id?: string | null
          id?: string
          origin?: string | null
          participant_key?: string | null
          reason?: string | null
          source?: string
          status?: string
          stream_id?: string
          target_kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          created_at: string
          external_author_id: string | null
          id: string
          metadata: Json
          origin: string
          points: number
          stream_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          external_author_id?: string | null
          id?: string
          metadata?: Json
          origin?: string
          points?: number
          stream_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          external_author_id?: string | null
          id?: string
          metadata?: Json
          origin?: string
          points?: number
          stream_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_events_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_gaps: {
        Row: {
          gap_end_at: string | null
          gap_start_at: string
          id: string
          stream_id: string
        }
        Insert: {
          gap_end_at?: string | null
          gap_start_at?: string
          id?: string
          stream_id: string
        }
        Update: {
          gap_end_at?: string | null
          gap_start_at?: string
          id?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_gaps_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_goals: {
        Row: {
          baseline_likes: number | null
          baseline_subs: number | null
          baseline_viewers: number | null
          likes_goal: number
          started_at: string | null
          stream_id: string
          subs_goal: number
          updated_at: string
          viewers_goal: number
        }
        Insert: {
          baseline_likes?: number | null
          baseline_subs?: number | null
          baseline_viewers?: number | null
          likes_goal?: number
          started_at?: string | null
          stream_id: string
          subs_goal?: number
          updated_at?: string
          viewers_goal?: number
        }
        Update: {
          baseline_likes?: number | null
          baseline_subs?: number | null
          baseline_viewers?: number | null
          likes_goal?: number
          started_at?: string | null
          stream_id?: string
          subs_goal?: number
          updated_at?: string
          viewers_goal?: number
        }
        Relationships: [
          {
            foreignKeyName: "stream_goals_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: true
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_keys: {
        Row: {
          channel_id: string
          created_at: string
          key: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          key: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_keys_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          channel_id: string
          created_at: string
          created_in_ui: boolean
          description: string | null
          disabled_commands: string[]
          ended_at: string | null
          hls_path: string | null
          id: string
          last_seen_at: string | null
          live_at: string | null
          max_viewers: number
          scheduled_start_at: string | null
          started_at: string | null
          status: string
          thumbnail_path: string | null
          title: string | null
          waiting_room_chat: boolean
          youtube_channel_id: string | null
          youtube_video_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_in_ui?: boolean
          description?: string | null
          disabled_commands?: string[]
          ended_at?: string | null
          hls_path?: string | null
          id?: string
          last_seen_at?: string | null
          live_at?: string | null
          max_viewers?: number
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string | null
          waiting_room_chat?: boolean
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_in_ui?: boolean
          description?: string | null
          disabled_commands?: string[]
          ended_at?: string | null
          hls_path?: string | null
          id?: string
          last_seen_at?: string | null
          live_at?: string | null
          max_viewers?: number
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string | null
          waiting_room_chat?: boolean
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streams_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          created_at: string
          end_s: number
          id: string
          start_s: number
          stream_id: string
          text: string
        }
        Insert: {
          created_at?: string
          end_s: number
          id?: string
          start_s: number
          stream_id: string
          text: string
        }
        Update: {
          created_at?: string
          end_s?: number
          id?: string
          start_s?: number
          stream_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_requests: {
        Row: {
          approved_at: string | null
          audio_path: string | null
          author_name: string | null
          channel_id: string
          chat_message_id: string | null
          created_at: string
          id: string
          origin: string
          participant_key: string
          played_at: string | null
          reason: string | null
          status: string
          stream_id: string
          text: string
        }
        Insert: {
          approved_at?: string | null
          audio_path?: string | null
          author_name?: string | null
          channel_id: string
          chat_message_id?: string | null
          created_at?: string
          id?: string
          origin: string
          participant_key: string
          played_at?: string | null
          reason?: string | null
          status: string
          stream_id: string
          text: string
        }
        Update: {
          approved_at?: string | null
          audio_path?: string | null
          author_name?: string | null
          channel_id?: string
          chat_message_id?: string | null
          created_at?: string
          id?: string
          origin?: string
          participant_key?: string
          played_at?: string | null
          reason?: string | null
          status?: string
          stream_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "tts_requests_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tts_requests_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tts_requests_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          channel_id: string
          created_at: string
          description: string | null
          duration_s: number | null
          height: number | null
          id: string
          mp4_path: string | null
          preview_paths: string[]
          published_at: string | null
          source_stream_id: string | null
          status: string
          thumbnail_path: string | null
          title: string | null
          width: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          description?: string | null
          duration_s?: number | null
          height?: number | null
          id?: string
          mp4_path?: string | null
          preview_paths?: string[]
          published_at?: string | null
          source_stream_id?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string | null
          width?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          description?: string | null
          duration_s?: number | null
          height?: number | null
          id?: string
          mp4_path?: string | null
          preview_paths?: string[]
          published_at?: string | null
          source_stream_id?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_source_stream_id_fkey"
            columns: ["source_stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_scores: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          external_author_id: string | null
          features_count: number
          last_featured_at: string | null
          origin: string
          participant_key: string
          stream_id: string
          total_score: number
          user_id: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          external_author_id?: string | null
          features_count?: number
          last_featured_at?: string | null
          origin?: string
          participant_key?: string
          stream_id: string
          total_score?: number
          user_id?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          external_author_id?: string | null
          features_count?: number
          last_featured_at?: string | null
          origin?: string
          participant_key?: string
          stream_id?: string
          total_score?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viewer_scores_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_heartbeats: {
        Row: {
          channel_id: string
          last_heartbeat_at: string
        }
        Insert: {
          channel_id: string
          last_heartbeat_at?: string
        }
        Update: {
          channel_id?: string
          last_heartbeat_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_heartbeats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_chat_archive: {
        Row: {
          author_channel_id: string
          author_name: string | null
          body: string
          id: string
          message_id: string
          published_at: string
          video_id: string
        }
        Insert: {
          author_channel_id: string
          author_name?: string | null
          body: string
          id?: string
          message_id: string
          published_at: string
          video_id: string
        }
        Update: {
          author_channel_id?: string
          author_name?: string | null
          body?: string
          id?: string
          message_id?: string
          published_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_chat_archive_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_vods"
            referencedColumns: ["video_id"]
          },
        ]
      }
      youtube_links: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verify_code: string
          youtube_channel_id: string
          youtube_handle: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verify_code: string
          youtube_channel_id: string
          youtube_handle: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verify_code?: string
          youtube_channel_id?: string
          youtube_handle?: string
        }
        Relationships: []
      }
      youtube_vods: {
        Row: {
          backfilled_at: string
          message_count: number
          published_at: string | null
          title: string | null
          video_id: string
        }
        Insert: {
          backfilled_at?: string
          message_count?: number
          published_at?: string | null
          title?: string | null
          video_id: string
        }
        Update: {
          backfilled_at?: string
          message_count?: number
          published_at?: string | null
          title?: string | null
          video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email_signup_status: { Args: { p_email: string }; Returns: string }
      is_participant_banned: { Args: { p_user: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
