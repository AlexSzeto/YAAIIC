# Untitled Feature

## Goals

## Tasks

## Reference Material

Designing an "ambient logic" system for sound is all about understanding how the physical world beats up a clean audio signal before it hits your ears.

If you're building a library of filters to simulate reality, you’ve already got **Occlusion** (low-pass) and **Space** (reverb) down. Here are several other essential filters and effects to round out your toolkit:

---

### 1. Air Absorption (The "Distance" Filter)

As sound travels through air, high frequencies are absorbed faster than low frequencies. This is different from "passing through a wall" because it’s a gradual slope based on distance.

* **The Filter:** A dynamic **High-Shelf** or **Low-Pass** filter where the cutoff frequency drops as the "distance" variable increases.
* **The Effect:** Simulates a distant thunderclap or a concert happening miles away.

### 2. The Doppler Effect (The "Drive-By" Filter)

When a sound source moves toward or away from a listener, the pitch shifts because the sound waves are being compressed or stretched.

* **The Filter:** A pitch-shifter linked to the velocity of the object.
* **The Effect:** Essential for vehicles, passing bullets, or a screaming character falling off a ledge.

### 3. Early Reflections (The "Clutter" Filter)

Before the "tail" of a reverb kicks in, you hear the first few bounces off nearby surfaces. This tells the brain how big the room is and where the walls are.

* **The Filter:** A very short **Delay (5ms – 30ms)** with low feedback.
* **The Effect:** Simulates standing in a small bathroom versus a narrow hallway. It adds "density" without the "washiness" of full reverb.

### 4. Resonant Diffraction (The "Around the Corner" Filter)

Sound doesn't just stop at a corner; it bends around it. However, high frequencies don't bend well, while low frequencies do.

* **The Filter:** A **Low-Pass Filter** combined with a slight **Phase Shift**.
* **The Effect:** Simulates hearing a conversation in the next room through an open door, or a car engine idling behind a building.

### 5. Media Emulation (The "Speaker" Filter)

Sometimes the sound isn't "live"; it’s coming through a device. Devices have physical limitations in their frequency response.

* **The Filter:**
* **Small Speaker:** High-pass filter (removes bass) + a narrow "honky" boost around 1kHz – 2kHz.
* **Old Radio:** Add a **Bitcrusher** (for digital artifacts) or a **Band-pass** filter (removes highs and lows) with added white noise.
* **Telephone:** A very aggressive Band-pass filter limited to 300Hz – 3.4kHz.



### 6. Medium Simulation (The "Underwater" Filter)

Sound travels faster in water, but the density of the fluid acts as a massive dampener for higher frequencies and creates a unique resonance.

* **The Filter:** A heavy **Low-Pass Filter** (cutoff around 400Hz) combined with a **Comb Filter** or a short, metallic **Chorus/Flanger**.
* **The Effect:** Creates that "submerged" feeling where everything sounds heavy and rhythmic.

### 7. The "Shell" Effect (The "Tinnitus/Stun" Filter)

In games or films, after an explosion, the character’s hearing is temporarily "blown out."

* **The Filter:** A **High-Pass Filter** that slowly sweeps back down to normal, combined with a constant high-pitched sine wave (Ring Modulation).
* **The Effect:** Simulates the physiological response to acoustic trauma.

---

### Comparison Summary

| Effect | Primary Tool | Physical Logic |
| --- | --- | --- |
| **Distance** | High-Shelf Filter | High frequencies die out in the air. |
| **Occlusion** | Low-Pass Filter | Solid objects block high frequencies. |
| **Doppler** | Pitch Shifter | Velocity changes wave frequency. |
| **Diffraction** | Low-Pass + Delay | Sound "bends" around corners. |
| **Underwater** | Comb Filter + LPF | Dense medium vibrates differently. |

Would you like me to help you write some **pseudocode** or a **Node.js script** using the Web Audio API to implement one of these filters?