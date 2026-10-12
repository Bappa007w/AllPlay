import { AudioLines, Headphones, Laptop, Music2, Smartphone, Tablet } from "lucide-react";

export function DeviceScene() {
  return (
    <figure className="scene-figure">
      <div className="device-scene" aria-hidden="true">
        <div className="orbit orbit-outer" />
        <div className="orbit orbit-middle" />
        <div className="orbit orbit-inner" />
        <div className="orbit-dot dot-one" />
        <div className="orbit-dot dot-two" />
        <div className="scene-label label-top">
          <span className="tiny-dot" /> A little closer. A little louder.
        </div>
        <div className="laptop-device">
          <div className="laptop-screen">
            <span className="device-wordmark">
              <AudioLines size={14} /> AllPlay
            </span>
            <div className="record-art">
              <div className="record">
                <div className="record-center">
                  <Music2 size={23} />
                </div>
              </div>
            </div>
            <div className="screen-caption">
              YOUR SOUND.
              <br />
              <strong>EVERYWHERE.</strong>
            </div>
            <div className="device-track">
              <span />
              <span />
            </div>
          </div>
          <div className="laptop-base" />
        </div>
        <div className="phone-device">
          <span className="phone-camera" />
          <div className="phone-art">
            <AudioLines size={34} />
          </div>
          <span className="phone-title">Same beat.</span>
          <span className="phone-subtitle">Different device.</span>
          <div className="phone-progress" />
          <div className="phone-controls">
            <i />
            <span>
              <Music2 size={14} />
            </span>
            <i />
          </div>
        </div>
        <div className="speaker-device">
          <div className="speaker-top" />
          <div className="speaker-mesh" />
          <span />
        </div>
        <div className="device-chip chip-phone">
          <Smartphone size={17} />
          <span>Phone</span>
        </div>
        <div className="device-chip chip-laptop">
          <Laptop size={17} />
          <span>Laptop</span>
        </div>
        <div className="device-chip chip-tablet">
          <Tablet size={17} />
          <span>Tablet</span>
        </div>
        <div className="scene-label label-bottom">
          <Headphones size={14} /> Many devices. One shared moment.
        </div>
      </div>
      <figcaption>Concept illustration · no audio playing</figcaption>
    </figure>
  );
}
