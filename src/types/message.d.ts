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
export declare namespace Card {
    type Theme = "primary" | "secondary" | "warning" | "danger" | "info";
    type Module = Section | ImageGroup | Header | Divider | File | Countdown | Context;
    interface Text {
        type: "plain-text" | "kmarkdown";
        content: string;
        emoji?: boolean;
    }
    interface Paragraph {
        type: "paragraph";
        content: string;
        cols: number;
        fields: Text[];
    }
    interface Section {
        type: "section";
        mode?: "left" | "right";
        text: Text | Paragraph;
        accessory?: Image | Button;
    }
    interface Image {
        type: "image";
        size?: "lg" | "sm";
        src: string;
        alt?: string;
        circle?: boolean;
    }
    interface Button {
        type: "button";
        theme?: Theme;
        value: string;
        text: Text;
        click?: string;
    }
    interface ImageGroup {
        type: "image-group";
        elements: Image[];
    }
    interface Header {
        type: "header";
        text: Text;
    }
    interface Divider {
        type: "divider";
    }
    interface ActionGroup {
        type: "action-group";
        elements: Button[];
    }
    interface Context {
        type: "context";
        elements: (Text | Image)[];
    }
    interface File {
        type: "file" | "audio" | "video";
        src: string;
        title: string;
        cover?: string;
    }
    interface Countdown {
        type: "countdown";
        end_time: string;
        start_time: string;
        mode: "day" | "hour" | "second";
    }
}
export {};
