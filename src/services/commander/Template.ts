import { IHelpContent } from './commander';

export class CardTemplate {
  static Color = {
    required: 'purple',
    optional: 'success',
    flags: 'pink',
  };
  static CommandList(
    title: string,
    commands: { name: string; description: string }[],
    input: string,
    avatar: string,
  ) {
    let content = '**指令** - *描述* \n';
    for (const b of commands) {
      content += `**${b.name}** - *${b.description}*\n`;
    }

    const a = [
      {
        type: 'card',
        size: 'lg',
        theme: 'warning',
        modules: [
          {
            type: 'header',
            text: {
              type: 'plain-text',
              content: title,
            },
          },
          {
            type: 'section',
            text: {
              type: 'kmarkdown',
              content: content,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'plain-text',
                content: '匹配触发：',
              },
              ...(avatar.includes('avatars')
                ? [
                    {
                      type: 'image',
                      src: avatar,
                      alt: '',
                      size: 'lg',
                      circle: true,
                    },
                  ]
                : []),
              {
                type: 'kmarkdown',
                content: input,
              },
            ],
          },
        ],
      },
    ];

    return JSON.stringify(a);
  }

  static HelpCardTemplate(name: string, obj: IHelpContent) {
    const base = [
      {
        type: 'card',
        theme: 'secondary',
        size: 'lg',
        modules: [
          {
            type: 'header',
            text: {
              type: 'plain-text',
              content: `指令帮助 - ${name}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'kmarkdown',
                content:
                  '描述：' +
                  obj.description +
                  `     (font)必填(font)[${this.Color.required}] (font)选填(font)[${this.Color.optional}] (font)标签(font)[${this.Color.flags}]`,
              },
            ],
          },
        ],
      },
    ];

    let additionalContent = '';
    for (const [key, value] of Object.entries(obj?.required ?? {})) {
      additionalContent += `(font)${key}(font)[${this.Color.required}] - ${value}\n`;
    }

    for (const [key, value] of Object.entries(obj?.optional ?? {})) {
      additionalContent += `(font)${key}(font)[${this.Color.optional}] - ${value}\n`;
    }

    for (const [key, value] of Object.entries(obj?.flags ?? {})) {
      additionalContent += `(font)${key}(font)[${this.Color.flags}] - ${value}\n`;
    }

    if (additionalContent) {
      base[0].modules.push({
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: additionalContent,
        },
      });
    }

    return JSON.stringify(base);
  }
}
