import { useEditorStore } from "../../store/editorStore"
import Clip from "./Clip"

export default function Track({ track }) {
  const addClip = useEditorStore((state) => state.addClip)

  return (
    <div className="track">
      <div className="track-header">
        <span>{track.type.toUpperCase()}</span>
        <button onClick={() => addClip(track.track_id)}>
          + Add Clip
        </button>
      </div>

      <div className="track-clips">
        {track.clips.map(clip => (
          <Clip key={clip.clip_id} clip={clip} />
        ))}
      </div>
    </div>
  )
}
