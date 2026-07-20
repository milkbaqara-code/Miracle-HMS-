// ============================================================
// SYNAPSE NEXUS — SHARED TYPE DEFINITIONS
// Single source of truth for all Zone 20 interfaces.
// ============================================================

export interface EmpNode {
  id: string;
  name: string;
  position: string;
  department: string;
  on_duty: boolean;
  is_online: boolean;
  last_seen: string | null;
  status: string;
  avatar_url: string;
  executive_tier: string;
  tier_weight: number;
}

export interface Directive {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  priority_weight: number;
  issued_by: string;
  target_dept: string;
  node_count: number;
  completion_pct: number;
  tagged_operatives?: string[];
  parent_directive_id?: number | null;
  nodes: { 
    id: number; 
    task: string; 
    done: boolean;
    requires_verification?: boolean;
    verification_status?: string; 
  }[];
  files?: { id: string; name: string; url: string }[];
}

export interface Room {
  room_id: string;
  room_name: string;
  created_by: string;
  peer_count: number;
}

export interface SynapseMessage {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_tier: number;
  content: string;
  msg_type: string;
  attachment_url?: string;
  file_type?: string;
  file_size_bytes?: number;
  sent_at: string;
}

export interface SynapseThread {
  thread_id: string;
  thread_type: string;
  subject: string;
  last_message: string;
  last_sender: string;
  last_at: string;
  unread: number;
  initiator_id: string;
  target_id: string;
  bridge_manager_id: string | null;
}

export interface VaultFile {
  id: string;
  original_name: string;
  file_type: string;
  file_size_bytes: number;
  category: string;
  description: string;
  uploaded_by: string;
  uploaded_at: string;
  download_url: string;
}

export interface VaultData {
  vault_id: number;
  employee_name: string;
  total_files: number;
  files: VaultFile[];
  grouped: Record<string, VaultFile[]>;
}
