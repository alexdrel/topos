# Topos MarkdownIt

```topos width=800
:map
## EARTH ORBIT                                     ## MARS ORBIT
            ┌────────┐                          ┌──────────────────┐
            │  TDRS  ◀──────────────────────────┤   Mars Orbiter   │
            └───┬────┘                          └────────▲───▲─────┘
                │                                        │   │
                │                                        │   │
                │       ┌────────────────────────────────┘   │
                │       │                                    │
                │       │                                    │
## EARTH        │       │                          ## MARS   │
                │       │                                    │
                │       │                                    │
                ▼       │                                    │
    ┌─OBSERVATORIES─────┴──────┐                ┌─ROVERS─────▼──────┐
    │                          │                │                   │
    │  ┌────────┐  ┌────────┐  │                │   Opportunity     │
    │  │   US   │  │   EU   │  ◀──Telemetry─────┤   Perseverance    │
    │  └────────┘  └────────┘  │                │   Curiosity       │
    └───────────▲──────────────┘                │   Spirit          │
                │                               └───────────────────┘
                │
                │
    ┌───────────▼──────────────┐
    │     Mission Control      │
    │                          │
    └──────────────────────────┘

:legend
[/]: green
{*}: stroke=none
{EARTH ORBIT} : purple
{EARTH} : blue
{MARS ORBIT}, {MARS} : red
ROVERS > * : center
```

Markdown preview renders fenced `topos` blocks:

```topos "MD" theme=light bg=light scale=1.5 !
[ MD ] -> [Topos]
:legend bg=dark
```

```topos "Inline" theme=dark bg=transparent width=800
[parseTopos(source)] -> [renderToSVG(ast)]
```

Topos may be included as an image: ![Topos Architecture](./topos.topos#scale=0.5)

An optional Markdown image title replaces the Topos title: ![Mars](./mars-2022-palette.topos#width=800 "Mars 2022 AD")
