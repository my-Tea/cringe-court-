import { Logo, PaperButton, PaperField, PaperNavBar, PaperPanel, PaperRibbon, PaperTab, PaperTile, Icon, useToast } from '@/ds';
import styles from './Gallery.module.css';
import { GallerySection, Specimen } from './Specimen';

/** The papercraft primitives (STYLE-GUIDE §9). */
export function PapercraftSection() {
  const { toast } = useToast();
  const soon = (name: string) => () => toast({ tone: 'info', title: `${name} sign-in is coming soon` });
  return (
    <GallerySection
      id="papercraft"
      title="Papercraft"
      description="Everything is cut and folded from card: layered sheets with soft shadows, fold facets, torn and zig-zag edges, paper grain."
    >
      <Specimen label="Logo" note="<Logo layout />" layout="grid3">
        <div className={styles.paperLogo}>
          <Logo layout="stacked" />
        </div>
        <div className={styles.paperLogo}>
          <Logo layout="inline" />
        </div>
        <div className={styles.paperLogo} style={{ maxWidth: '6rem' }}>
          <Logo layout="mark" />
        </div>
      </Specimen>
      <Specimen label="Paper panels" note="<PaperPanel tone edge elevation backing />" layout="grid3">
        <PaperPanel edge="torn" elevation={2}>
          <strong>Cream, torn</strong>
          <p>Torn top and bottom, elevation 2.</p>
        </PaperPanel>
        <PaperPanel tone="maroon" edge="cut" elevation={3} backing="gold">
          <strong>Maroon, cut, gold backing</strong>
          <p>Children re-theme to the wood surface.</p>
        </PaperPanel>
        <PaperPanel tone="gold" edge="zigzag" elevation={1}>
          <strong>Gold, zig-zag</strong>
          <p>Pinking-shear edge, elevation 1.</p>
        </PaperPanel>
      </Specimen>
      <Specimen label="Ribbons" note="<PaperRibbon tone size tails sparks />" layout="stack">
        <PaperRibbon as="p" sparks>
          The court is now in session
        </PaperRibbon>
        <PaperRibbon as="p" size="sm" tails={false}>
          Make your case. Lose your dignity.
        </PaperRibbon>
        <PaperRibbon as="p" tone="maroon">
          Exhibit A
        </PaperRibbon>
        <PaperRibbon as="p" tone="gold" size="lg">
          Verdict
        </PaperRibbon>
      </Specimen>
      <Specimen label="Paper buttons" note="<PaperButton variant /> · press = paper depress">
        <PaperButton size="xl" iconStart={<Icon name="gavel" />}>
          Enter the court
        </PaperButton>
        <PaperButton variant="maroon" size="lg" iconStart={<Icon name="gamepad" />}>
          Play as guest
        </PaperButton>
        <PaperButton variant="ghost">Ghost</PaperButton>
        <PaperButton disabled>Disabled</PaperButton>
      </Specimen>
      <Specimen label="Paper fields" note="<PaperField icon revealable />" layout="grid2">
        <PaperField label="Email" icon="mail" type="email" placeholder="Enter your email" autoComplete="off" />
        <PaperField label="Password" icon="lock" type="password" placeholder="Enter your password" revealable autoComplete="off" />
        <PaperField label="Case title" icon="document" iconPlacement="inside" placeholder="The group-chat incident" hint="Shown publicly." />
        <PaperField label="Handle" icon="user" placeholder="@juror" error="That handle is taken." optional />
      </Specimen>
      <Specimen label="Paper tiles" note="<PaperTile icon label shape tone />">
        <PaperTile icon="discord" label="Continue with Discord" tone="blue" onClick={soon('Discord')} />
        <PaperTile icon="google" label="Continue with Google" tone="cream" onClick={soon('Google')} />
        <PaperTile icon="apple" label="Continue with Apple" onClick={soon('Apple')} />
        <PaperTile icon="scales" label="Courts" shape="round" tone="gold" />
        <PaperTile icon="trophy" label="Leaderboard" shape="round" tone="teal" size="lg" />
      </Specimen>
      <Specimen label="Nav bar and tabs" note="<PaperNavBar><PaperTab /></PaperNavBar>" layout="stack">
          <PaperNavBar label="Gallery demo" end={<PaperButton size="sm" iconStart={<Icon name="gavel" />}>Enter court</PaperButton>}>
            <PaperTab to="/gallery" icon="home" end>
              Home
            </PaperTab>
            <PaperTab to="/court" icon="scales">
              The court
            </PaperTab>
            <PaperTab to="/leaderboard" icon="trophy">
              Leaderboard
            </PaperTab>
            <PaperTab to="/how-to-play" icon="book">
              How to play
            </PaperTab>
          </PaperNavBar>
      </Specimen>
    </GallerySection>
  );
}
