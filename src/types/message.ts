import { MessageType, User } from "./base";
import { Notice } from "./system";

export interface MessageMeta {
  mention: string[];
  mention_all: boolean;
  mention_roles: string[];
  mention_here: boolean;
  attachments: Attachment;
  quote: Message;
  author: Author;
  kmarkdown?: {
    raw_content: string;
    mention_part: KmarkdownUserMeta[];
    mention_role_part: KmarkdownRoleMeta[];
  };
}

export interface MessageBase {
  type: MessageType;
  content: string;
}

export interface Message extends MessageBase, MessageMeta {
  id: string;
  rong_id?: string;
  embeds: any[];
  reactions: any[];
  mention_info: object;
  extra: MessageExtra | Notice;
}

export interface MessageExtra extends MessageMeta {
  type: MessageType;
  code: string;
  guild_id: string;
  channel_name: string;
}

type AttachmentType = "image" | "video" | "audio" | "file";

export interface Attachment {
  type: AttachmentType;
  name: string;
  url: string;
  file_type: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}

export interface Author extends User {
  roles: number[];
  nickname?: string;
}

export interface KmarkdownUserMeta {
  id: string;
  username: string;
  full_name: string;
  avatar: string;
}

export interface KmarkdownRoleMeta {
  role_id: number;
  name: string;
  color: number;
}

export interface Emoji {
  id: string;
  name: string;
}

export interface Card {
  type: "card";
  theme?: Card.Theme;
  size?: "lg" | "sm";
  color?: string;
  modules: Card.Module[];
}

export namespace Card {
  export type Theme = "primary" | "secondary" | "warning" | "danger" | "info";
  export type Module =
    | Section
    | ImageGroup
    | Header
    | Divider
    | File
    | Countdown
    | Context;

  export interface Text {
    type: "plain-text" | "kmarkdown";
    content: string;
    emoji?: boolean;
  }

  export interface Paragraph {
    type: "paragraph";
    content: string;
    cols: number;
    fields: Text[];
  }

  export interface Section {
    type: "section";
    mode?: "left" | "right";
    text: Text | Paragraph;
    accessory?: Image | Button;
  }

  export interface Image {
    type: "image";
    size?: "lg" | "sm";
    src: string;
    alt?: string;
    circle?: boolean;
  }

  export interface Button {
    type: "button";
    theme?: Theme;
    value: string;
    text: Text;
    click?: string;
  }

  export interface ImageGroup {
    type: "image-group";
    elements: Image[];
  }

  export interface Header {
    type: "header";
    text: Text;
  }

  export interface Divider {
    type: "divider";
  }

  export interface ActionGroup {
    type: "action-group";
    elements: Button[];
  }

  export interface Context {
    type: "context";
    elements: (Text | Image)[];
  }

  export interface File {
    type: "file" | "audio" | "video";
    src: string;
    title: string;
    cover?: string;
  }

  export interface Countdown {
    type: "countdown";
    end_time: string;
    start_time: string;
    mode: "day" | "hour" | "second";
  }
}
