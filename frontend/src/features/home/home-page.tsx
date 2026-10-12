import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  Disc3,
  Headphones,
  Link2,
  ListMusic,
  MonitorSmartphone,
  Plus,
  Radio,
  ShieldCheck,
  Users,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceScene } from "./device-scene";

const steps = [
  {
    icon: Plus,
    title: "Make some room.",
    copy: "Create a space for your next listening session. You'll be the host.",
  },
  {
    icon: Link2,
    title: "Bring your people.",
    copy: "Share an invite link or room ID. Your friends bring their devices.",
  },
  {
    icon: ListMusic,
    title: "Find your sound.",
    copy: "Pick from the shared music library and build a queue together.",
  },
  {
    icon: Headphones,
    title: "Press play. Together.",
    copy: "Enable audio on each device, then settle into the same song.",
  },
];

export function HomePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <span className="tiny-dot" /> THE NEXT WAY TO LISTEN TOGETHER
          </div>
          <h1 id="hero-title">
            One Beat.
            <br />
            <span>Every Device.</span>
          </h1>
          <p className="hero-description">
            Turn your phones, laptops, and speakers into one synchronized music experience.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/create">
                <Plus size={18} aria-hidden="true" /> Create a room{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/join">
                Join a room <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="preview-note">Room sessions are ready. Music playback is coming soon.</p>
          <div className="hero-benefits">
            <span>
              <Check /> No account needed
            </span>
            <span>
              <Check /> Your devices, together
            </span>
          </div>
        </div>
        <DeviceScene />
      </section>

      <div className="compatibility container">
        <span className="eyebrow">ONE SPACE. ALL YOUR DEVICES.</span>
        <div>
          <MonitorSmartphone aria-hidden="true" /> Phones & laptops
        </div>
        <span className="strip-divider" />
        <div>
          <Headphones aria-hidden="true" /> Your connected speakers
        </div>
        <Link href="#how-it-works">
          Meet AllPlay <ArrowDown size={15} aria-hidden="true" />
        </Link>
      </div>

      <section id="features" className="section container" aria-labelledby="features-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BETTER IN GOOD COMPANY</p>
            <h2 id="features-title">
              Less setup.
              <br />
              More shared moments.
            </h2>
          </div>
          <p>
            From a quiet evening to a full house.
            <br />A shared soundtrack, built around you.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-wide">
            <div className="feature-icon">
              <AudioLines aria-hidden="true" />
            </div>
            <h3>One song. All around you.</h3>
            <p>
              Designed to bring your devices onto one playback timeline, wherever you find your
              place in the room.
            </p>
            <div className="timeline-art" aria-hidden="true">
              <div className="timeline-guide" />
              {["Phone", "Laptop", "Tablet"].map((label, index) => (
                <div className="timeline-row" key={label}>
                  <span>{label}</span>
                  <div className={`timeline-bars bars-${index}`}>
                    {Array.from({ length: 30 }, (_, i) => (
                      <i key={i} style={{ height: `${8 + ((i * 17 + index * 7) % 27)}px` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <span className="card-footnote">Shared timeline illustration</span>
          </article>
          <article className="feature-card">
            <div className="feature-icon violet">
              <Users aria-hidden="true" />
            </div>
            <h3>Your room. Your rhythm.</h3>
            <p>
              Host the session, invite your friends, and choose up to three Officers to help shape
              the queue.
            </p>
            <div className="role-stack" aria-label="Planned room roles">
              <span>
                <ShieldCheck size={16} /> Host <i>You&apos;re in control</i>
              </span>
              <span>
                <Users size={16} /> Officers <i>Up to 3</i>
              </span>
              <span>
                <Headphones size={16} /> Listeners <i>Just enjoy</i>
              </span>
            </div>
          </article>
          <article className="feature-card">
            <div className="feature-icon cyan">
              <Disc3 aria-hidden="true" />
            </div>
            <h3>
              A little discovery.
              <br />A lot to play.
            </h3>
            <p>
              Browse an administrator-curated library. Find a favorite sound and make it
              everyone&apos;s next track.
            </p>
            <div className="mini-records" aria-hidden="true">
              <div>
                <Disc3 />
              </div>
              <div>
                <Volume2 />
              </div>
              <div>
                <Radio />
              </div>
            </div>
          </article>
        </div>
        <p className="section-disclaimer">
          A look at what&apos;s coming. Shared playback and the music library are not available yet.
        </p>
      </section>

      <section
        id="how-it-works"
        className="how-section section container"
        aria-labelledby="how-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM YOUR FIRST CLICK TO YOUR FIRST BEAT</p>
            <h2 id="how-title">
              Good company.
              <br />
              Four simple steps.
            </h2>
          </div>
          <span className="pill">
            <Link2 size={14} aria-hidden="true" /> No sign-up. Just a room link.
          </span>
        </div>
        <ol className="steps">
          {steps.map(({ icon: Icon, title, copy }, i) => (
            <li key={title}>
              <div className="step-top">
                <span>0{i + 1}</span>
                <Icon aria-hidden="true" size={21} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="details-section container" aria-labelledby="details-title">
        <div>
          <p className="eyebrow">A FEW THINGS TO KNOW</p>
          <h2 id="details-title">Before the first beat.</h2>
          <p>Simple to join. Clear about what to expect.</p>
        </div>
        <div className="faq-list">
          <details>
            <summary>
              Will I need an account?
              <Plus aria-hidden="true" size={18} />
            </summary>
            <p>
              No. Room creation and joining are designed around a display name and a temporary
              browser session. Only the platform administrator signs in.
            </p>
          </details>
          <details>
            <summary>
              How will my speakers connect?
              <Plus aria-hidden="true" size={18} />
            </summary>
            <p>
              AllPlay runs in a browser on your phone, tablet or computer. That device can output to
              its built-in or connected speakers. Bluetooth can add timing differences.
            </p>
          </details>
          <details>
            <summary>
              Can I start listening now?
              <Plus aria-hidden="true" size={18} />
            </summary>
            <p>
              Not yet. You can create rooms, invite friends and see participants live. Music
              playback and the shared library are not available yet.
            </p>
          </details>
          <details>
            <summary>
              Will every device play perfectly in sync?
              <Plus aria-hidden="true" size={18} />
            </summary>
            <p>
              AllPlay is being designed for scheduled playback and timing correction. Actual timing
              depends on your browser, network and audio hardware. Keep the page open; background
              playback is not guaranteed.
            </p>
          </details>
        </div>
      </section>

      <section className="closing container">
        <div className="closing-symbol" aria-hidden="true">
          <AudioLines />
        </div>
        <p className="eyebrow">MAKE ROOM FOR YOUR NEXT FAVORITE MOMENT</p>
        <h2>
          Music sounds better
          <br />
          <span>with everyone.</span>
        </h2>
        <Button asChild>
          <Link href="/create">
            Explore room setup <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </Button>
        <p className="preview-note">Temporary rooms · no account required</p>
      </section>
    </main>
  );
}
