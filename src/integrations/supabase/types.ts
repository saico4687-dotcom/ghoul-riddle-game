export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answer_times: {
        Row: {
          created_at: string
          elapsed_ms: number
          game_mode: string
          id: string
          riddle_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          elapsed_ms: number
          game_mode?: string
          id?: string
          riddle_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          elapsed_ms?: number
          game_mode?: string
          id?: string
          riddle_index?: number
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      competition_scores: {
        Row: {
          created_at: string
          email: string | null
          entered_draw: boolean
          full_name: string | null
          id: string
          phone: string | null
          time_bonus: number
          total_correct: number
          total_points: number
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          entered_draw?: boolean
          full_name?: string | null
          id?: string
          phone?: string | null
          time_bonus?: number
          total_correct?: number
          total_points?: number
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          entered_draw?: boolean
          full_name?: string | null
          id?: string
          phone?: string | null
          time_bonus?: number
          total_correct?: number
          total_points?: number
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          archived_by: string[]
          created_at: string
          disappearing_seconds: number | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          muted_by: string[]
          pinned_by: string[]
          pinned_message_id: string | null
          pinned_until: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          archived_by?: string[]
          created_at?: string
          disappearing_seconds?: number | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          muted_by?: string[]
          pinned_by?: string[]
          pinned_message_id?: string | null
          pinned_until?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          archived_by?: string[]
          created_at?: string
          disappearing_seconds?: number | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          muted_by?: string[]
          pinned_by?: string[]
          pinned_message_id?: string | null
          pinned_until?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user: string
          id: string
          responded_at: string | null
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      group_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          group_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_bans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          status: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          status?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          expires_at: string | null
          group_id: string
          id: string
          image_url: string | null
          live_location_until: string | null
          location_lat: number | null
          location_lng: number | null
          location_label: string | null
          media_deleted_at: string | null
          media_duration_seconds: number | null
          media_expires_at: string | null
          media_iv: string | null
          media_key: string | null
          media_mime: string | null
          media_path: string | null
          media_size_bytes: number | null
          media_type: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
          system_event: string | null
          view_once: boolean
          viewed_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          live_location_until?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_label?: string | null
          media_deleted_at?: string | null
          media_duration_seconds?: number | null
          media_expires_at?: string | null
          media_iv?: string | null
          media_key?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
          system_event?: string | null
          view_once?: boolean
          viewed_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          live_location_until?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_label?: string | null
          media_deleted_at?: string | null
          media_duration_seconds?: number | null
          media_expires_at?: string | null
          media_iv?: string | null
          media_key?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
          system_event?: string | null
          view_once?: boolean
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_reports: {
        Row: {
          created_at: string
          group_id: string
          id: string
          reason: string
          reporter_id: string
          status: string
          target_message_id: string | null
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_message_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_message_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_reports_target_message_id_fkey"
            columns: ["target_message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          disappearing_seconds: number | null
          id: string
          invite_code: string
          invite_enabled: boolean
          last_message_at: string | null
          last_message_preview: string | null
          lock_chat: boolean
          muted_by: string[]
          name: string
          owner_id: string
          pinned_message_id: string | null
          pinned_until: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          disappearing_seconds?: number | null
          id?: string
          invite_code?: string
          invite_enabled?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lock_chat?: boolean
          muted_by?: string[]
          name: string
          owner_id: string
          pinned_message_id?: string | null
          pinned_until?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          disappearing_seconds?: number | null
          id?: string
          invite_code?: string
          invite_enabled?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lock_chat?: boolean
          muted_by?: string[]
          name?: string
          owner_id?: string
          pinned_message_id?: string | null
          pinned_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          edited_at: string | null
          expires_at: string | null
          hidden_for: string[]
          id: string
          is_deleted_for_everyone: boolean
          live_location_until: string | null
          location_lat: number | null
          location_lng: number | null
          location_label: string | null
          media_deleted_at: string | null
          media_duration_seconds: number | null
          media_expires_at: string | null
          media_iv: string | null
          media_key: string | null
          media_mime: string | null
          media_path: string | null
          media_size_bytes: number | null
          media_type: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
          view_once: boolean
          viewed_at: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          hidden_for?: string[]
          id?: string
          is_deleted_for_everyone?: boolean
          live_location_until?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_label?: string | null
          media_deleted_at?: string | null
          media_duration_seconds?: number | null
          media_expires_at?: string | null
          media_iv?: string | null
          media_key?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
          view_once?: boolean
          viewed_at?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          hidden_for?: string[]
          id?: string
          is_deleted_for_everyone?: boolean
          live_location_until?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_label?: string | null
          media_deleted_at?: string | null
          media_duration_seconds?: number | null
          media_expires_at?: string | null
          media_iv?: string | null
          media_key?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
          view_once?: boolean
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          created_at: string
          group_message_id: string | null
          id: string
          mentioned_user_id: string
          message_id: string | null
        }
        Insert: {
          created_at?: string
          group_message_id?: string | null
          id?: string
          mentioned_user_id: string
          message_id?: string | null
        }
        Update: {
          created_at?: string
          group_message_id?: string | null
          id?: string
          mentioned_user_id?: string
          message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_group_message_id_fkey"
            columns: ["group_message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_polls: {
        Row: {
          allow_multiple: boolean
          closed_at: string | null
          created_at: string
          creator_id: string
          group_id: string
          id: string
          message_id: string | null
          question: string
        }
        Insert: {
          allow_multiple?: boolean
          closed_at?: string | null
          created_at?: string
          creator_id: string
          group_id: string
          id?: string
          message_id?: string | null
          question: string
        }
        Update: {
          allow_multiple?: boolean
          closed_at?: string | null
          created_at?: string
          creator_id?: string
          group_id?: string
          id?: string
          message_id?: string | null
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_poll_options: {
        Row: {
          id: string
          option_text: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          option_text: string
          poll_id: string
          position?: number
        }
        Update: {
          id?: string
          option_text?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "group_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      group_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "group_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "group_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          background_color: string | null
          created_at: string
          expires_at: string
          id: string
          kind: string
          media_iv: string | null
          media_key: string | null
          media_mime: string | null
          media_path: string | null
          text_content: string | null
          user_id: string
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          kind: string
          media_iv?: string | null
          media_key?: string | null
          media_mime?: string | null
          media_path?: string | null
          text_content?: string | null
          user_id: string
        }
        Update: {
          background_color?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          media_iv?: string | null
          media_key?: string | null
          media_mime?: string | null
          media_path?: string | null
          text_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          callee_id: string
          caller_id: string
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          status: string
        }
        Insert: {
          callee_id: string
          caller_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: string
          status?: string
        }
        Update: {
          callee_id?: string
          caller_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: string
          status?: string
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          id: number
          payload: Json
          sender_id: string
          signal_type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: number
          payload: Json
          sender_id: string
          signal_type: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: number
          payload?: Json
          sender_id?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          notes: string | null
          target_user_id: string
          until: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          target_user_id: string
          until?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          target_user_id?: string
          until?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ad_free_until: string | null
          address: string | null
          app_lock_enabled: boolean
          app_lock_hash: string | null
          avatar_url: string | null
          bio: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          e2e_public_key: string | null
          email: string | null
          full_name: string | null
          id: string
          is_muted_until: string | null
          is_suspended_until: string | null
          last_puzzle_index: number
          last_seen_at: string | null
          name: string | null
          phone: string | null
          privacy_friend_requests: Database["public"]["Enums"]["chat_visibility"]
          privacy_last_seen: Database["public"]["Enums"]["chat_visibility"]
          privacy_messages: Database["public"]["Enums"]["chat_visibility"]
          profile_image: string | null
          riddles_completed_count: number
          saved_score: number
          saved_time_bonus: number
          saved_total_points: number
          total_time_ms: number
          updated_at: string
          user_id: string
          username: string | null
          username_changed_at: string | null
        }
        Insert: {
          ad_free_until?: string | null
          address?: string | null
          app_lock_enabled?: boolean
          app_lock_hash?: string | null
          avatar_url?: string | null
          bio?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          e2e_public_key?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_muted_until?: string | null
          is_suspended_until?: string | null
          last_puzzle_index?: number
          last_seen_at?: string | null
          name?: string | null
          phone?: string | null
          privacy_friend_requests?: Database["public"]["Enums"]["chat_visibility"]
          privacy_last_seen?: Database["public"]["Enums"]["chat_visibility"]
          privacy_messages?: Database["public"]["Enums"]["chat_visibility"]
          profile_image?: string | null
          riddles_completed_count?: number
          saved_score?: number
          saved_time_bonus?: number
          saved_total_points?: number
          total_time_ms?: number
          updated_at?: string
          user_id: string
          username?: string | null
          username_changed_at?: string | null
        }
        Update: {
          ad_free_until?: string | null
          address?: string | null
          app_lock_enabled?: boolean
          app_lock_hash?: string | null
          avatar_url?: string | null
          bio?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          e2e_public_key?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_muted_until?: string | null
          is_suspended_until?: string | null
          last_puzzle_index?: number
          last_seen_at?: string | null
          name?: string | null
          phone?: string | null
          privacy_friend_requests?: Database["public"]["Enums"]["chat_visibility"]
          privacy_last_seen?: Database["public"]["Enums"]["chat_visibility"]
          privacy_messages?: Database["public"]["Enums"]["chat_visibility"]
          profile_image?: string | null
          riddles_completed_count?: number
          saved_score?: number
          saved_time_bonus?: number
          saved_total_points?: number
          total_time_ms?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          username_changed_at?: string | null
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          score: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          score?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          score?: number
          user_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
          target_message_id: string | null
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_message_id?: string | null
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_message_id?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_target_message_id_fkey"
            columns: ["target_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed: boolean
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["todo_priority"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["todo_priority"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["todo_priority"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_beat: string
          last_seen_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_beat?: string
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_beat?: string
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          completed: boolean | null
          is_muted_until: string | null
          is_suspended_until: string | null
          joined_at: string | null
          last_seen_at: string | null
          riddles_completed: number | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          completed?: boolean | null
          is_muted_until?: string | null
          is_suspended_until?: string | null
          joined_at?: string | null
          last_seen_at?: string | null
          riddles_completed?: never
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          completed?: boolean | null
          is_muted_until?: string | null
          is_suspended_until?: string | null
          joined_at?: string | null
          last_seen_at?: string | null
          riddles_completed?: never
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      ban_group_member: {
        Args: { _group_id: string; _reason: string; _target_user: string }
        Returns: undefined
      }
      can_post_in_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      get_fastest_answers: {
        Args: never
        Returns: {
          elapsed_ms: number
          riddle_index: number
          user_id: string
        }[]
      }
      get_group_role: {
        Args: { _group_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["group_role"]
      }
      get_or_create_conversation: { Args: { _other: string }; Returns: string }
      get_public_profile: {
        Args: { _uid: string }
        Returns: {
          avatar_url: string
          bio: string
          completed: boolean
          is_online: boolean
          last_seen_at: string
          riddles_completed_count: number
          user_id: string
          username: string
        }[]
      }
      get_weekly_winner: {
        Args: { p_week_start: string }
        Returns: {
          fastest_answer_ms: number
          riddles_solved: number
          user_id: string
        }[]
      }
      has_completed_400: { Args: { _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _uid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_group_banned: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_staff: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_by_invite: { Args: { _invite_code: string }; Returns: string }
      leave_group: { Args: { _group_id: string }; Returns: undefined }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      presence_heartbeat: { Args: never; Returns: undefined }
      regenerate_group_invite: { Args: { _group_id: string }; Returns: string }
      remove_group_member: {
        Args: { _group_id: string; _target_user: string }
        Returns: undefined
      }
      search_users: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          last_seen_at: string
          riddles_completed: number
          user_id: string
          username: string
        }[]
      }
      set_group_admin: {
        Args: { _group_id: string; _make_admin: boolean; _target_user: string }
        Returns: undefined
      }
      set_username: { Args: { _new: string }; Returns: undefined }
      unban_group_member: {
        Args: { _group_id: string; _target_user: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      chat_visibility: "everyone" | "friends" | "none"
      group_role: "owner" | "admin" | "member"
      todo_priority: "high" | "medium" | "low"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      chat_visibility: ["everyone", "friends", "none"],
      group_role: ["owner", "admin", "member"],
      todo_priority: ["high", "medium", "low"],
    },
  },
} as const
