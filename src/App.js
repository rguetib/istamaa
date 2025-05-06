import React, { useState, useRef, useEffect } from 'react';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';
import './index.css';
import './App.css';

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [isLooping, setIsLooping] = useState(false);
  const [repeatCount, setRepeatCount] = useState("∞");

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const sliderRef = useRef(null);

  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const repeatCountRef = useRef(repeatCount);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

  useEffect(() => {
    if (videoType === 'youtube' && videoUrl) {
      const videoId = getVideoId(videoUrl);
      if (videoId) {
        loadYouTubePlayer(videoId);
      }
    }
  }, [videoUrl, videoType]);

  const getVideoId = (url) => {
    const regex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] || match[2] : null;
  };

  const loadYouTubePlayer = (videoId) => {
    const script = document.createElement('script');
    script.src = `https://www.youtube.com/iframe_api`;
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId,
        events: {
          onReady: onPlayerReady,
        },
      });
    };
  };

  const onPlayerReady = () => {
    const duration = playerRef.current.getDuration();
    setupSlider(duration);
  };

  const handleLocalVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoType('local');
      videoRef.current.src = URL.createObjectURL(file);
      videoRef.current.load();
    }
  };

  const setupSlider = (duration) => {
    if (sliderRef.current.noUiSlider) {
      sliderRef.current.noUiSlider.destroy();
    }

    noUiSlider.create(sliderRef.current, {
      start: [startTime, endTime],
      connect: true,
      range: {
        min: 0,
        max: duration,
      },
      step: 1,
    });

    sliderRef.current.noUiSlider.on('update', (values, handle) => {
      if (handle === 0) {
        setStartTime(parseFloat(values[0]));
      } else {
        setEndTime(parseFloat(values[1]));
      }
    });
  };

  const startLoop = () => {
    if (videoType === 'youtube') {
      playerRef.current.seekTo(startTimeRef.current);
      playerRef.current.playVideo();
      loopYouTubePlayer();
    } else if (videoType === 'local') {
      videoRef.current.currentTime = startTimeRef.current;
      videoRef.current.play();
      loopLocalVideo();
    }
  };

  const loopYouTubePlayer = () => {
    setIsLooping(true);
    let currentRepeat = repeatCountRef.current === '∞' ? '∞' : parseInt(repeatCountRef.current, 10);

    const interval = setInterval(() => {
      if (playerRef.current.getCurrentTime() >= endTimeRef.current) {
        if (currentRepeat !== '∞') {
          currentRepeat -= 1;
          setRepeatCount(currentRepeat.toString());
        }

        if (currentRepeat === 0) {
          clearInterval(interval);
          playerRef.current.pauseVideo();
          setIsLooping(false);
        } else {
          playerRef.current.seekTo(startTimeRef.current);
        }
      }
    }, 500);
  };

  const loopLocalVideo = () => {
    setIsLooping(true);
    let currentRepeat = repeatCountRef.current === '∞' ? '∞' : parseInt(repeatCountRef.current, 10);

    const interval = setInterval(() => {
      if (videoRef.current.currentTime >= endTimeRef.current) {
        if (currentRepeat !== '∞') {
          currentRepeat -= 1;
          setRepeatCount(currentRepeat.toString());
        }

        if (currentRepeat === 0) {
          clearInterval(interval);
          videoRef.current.pause();
          setIsLooping(false);
        } else {
          videoRef.current.currentTime = startTimeRef.current;
        }
      }
    }, 500);
  };

  const resetSettings = () => {
    setStartTime(0);
    setEndTime(10);
    setRepeatCount("∞");
    setIsLooping(false);

    if (sliderRef.current.noUiSlider) {
      sliderRef.current.noUiSlider.set([0, 10]);
    }

    if (videoType === 'youtube' && playerRef.current) {
      playerRef.current.pauseVideo();
      playerRef.current.seekTo(0);
    }

    if (videoType === 'local' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl text-center mb-6">استماع</h1>

      <div className="mb-4">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          className="w-full p-2 border rounded-lg text-lg"
        />
        <button onClick={() => setVideoType('youtube')} className="ml-4 p-2 bg-blue-500 text-white rounded-lg">
          Load YouTube Video
        </button>
      </div>

      <div className="mb-4">
        <input
          type="file"
          onChange={handleLocalVideoChange}
          accept="video/*"
          className="w-full p-2 border rounded-lg text-lg"
        />
      </div>

      <div id="youtube-player" style={{ display: videoType === 'youtube' ? 'block' : 'none' }}></div>
      <video ref={videoRef} controls style={{ display: videoType === 'local' ? 'block' : 'none' }}></video>

      <div className="my-4" ref={sliderRef}></div>

      <div className="mb-4">
        <label className="block mb-2">Start Time (mm:ss):</label>
        <input
          type="text"
          value={formatTime(startTime)}
          onChange={(e) => setStartTime(parseFloat(e.target.value))}
          className="w-full p-2 border rounded-lg text-lg"
        />
        <label className="block mb-2 mt-4">End Time (mm:ss):</label>
        <input
          type="text"
          value={formatTime(endTime)}
          onChange={(e) => setEndTime(parseFloat(e.target.value))}
          className="w-full p-2 border rounded-lg text-lg"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2">Repeat Count:</label>
        <select
          value={repeatCount}
          onChange={(e) => setRepeatCount(e.target.value)}
          className="w-full p-2 border rounded-lg text-lg"
        >
          {[...Array(10)].map((_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
          <option value="∞">∞</option>
        </select>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={startLoop}
          className="w-full sm:w-auto p-4 bg-green-500 text-white rounded-lg text-lg"
          disabled={isLooping}
        >
          Start Loop
        </button>
        <button
          onClick={resetSettings}
          className="w-full sm:w-auto p-4 bg-gray-500 text-white rounded-lg text-lg"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default App;