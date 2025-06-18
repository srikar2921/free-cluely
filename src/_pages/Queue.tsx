import React, { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "react-query"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastVariant,
  ToastMessage
} from "../components/ui/toast"
import QueueCommands from "../components/Queue/QueueCommands"

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  });

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Automation state
  const [isAutomationActive, setIsAutomationActive] = useState(false);
  const [automationInterval, setAutomationInterval] = useState(60); // Default interval
  const [isLoadingAutomationStatus, setIsLoadingAutomationStatus] = useState(true);

  const { data: screenshots = [], refetch } = useQuery<Array<{ path: string; preview: string }>, Error>(
    ["screenshots"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots();
        return existing;
      } catch (error) {
        console.error("Error loading screenshots:", error);
        showToast("Error", "Failed to load existing screenshots", "error");
        return [];
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true
    }
  );

  // Effect to fetch initial automation status
  useEffect(() => {
    setIsLoadingAutomationStatus(true);
    window.electronAPI.getAutomationStatus().then(status => {
      setIsAutomationActive(status.isActive);
      setAutomationInterval(status.interval);
      setIsLoadingAutomationStatus(false);
    }).catch(err => {
      console.error("Error fetching automation status:", err);
      setIsLoadingAutomationStatus(false);
    });
  }, []);

  // Event handlers for automation
  const handleToggleAutomation = useCallback(() => {
    const newIsActive = !isAutomationActive;
    window.electronAPI.setAutomationActive(newIsActive).then(() => {
      setIsAutomationActive(newIsActive);
      if (!newIsActive) { // If stopping automation, re-enable interval input
        // No specific action needed here as disabled state of input is derived
      }
    }).catch(err => console.error("Error setting automation active:", err));
  }, [isAutomationActive]);

  const handleIntervalChange = useCallback((newIntervalString: string) => {
    const newInterval = parseInt(newIntervalString, 10);
    if (!isNaN(newInterval) && newInterval > 0) {
      window.electronAPI.setAutomationInterval(newInterval).then(() => {
        setAutomationInterval(newInterval);
      }).catch(err => console.error("Error setting automation interval:", err));
    }
  }, []);


  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant });
    setToastOpen(true);
  };

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        refetch();
      } else {
        console.error("Failed to delete screenshot:", response.error);
        showToast("Error", "Failed to delete the screenshot file", "error");
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
    }
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (isTooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        )
        setView("queue")
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no screenshots to process.",
          "neutral"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  return (
    <div ref={contentRef} className={`bg-transparent w-1/2`}>
      <div className="px-4 py-3">
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant={toastMessage.variant}
          duration={3000}
        >
          <ToastTitle>{toastMessage.title}</ToastTitle>
          <ToastDescription>{toastMessage.description}</ToastDescription>
        </Toast>

        <div className="space-y-3 w-fit">
          {/* Automation Controls */}
          <div className="flex items-center space-x-2 p-2 bg-gray-800/50 backdrop-blur-md rounded-md my-2 border border-gray-700/50 shadow-sm">
            <button
              onClick={handleToggleAutomation}
              disabled={isLoadingAutomationStatus}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                         ${isLoadingAutomationStatus
                           ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                           : isAutomationActive
                             ? 'bg-red-600 hover:bg-red-700 text-white'
                             : 'bg-green-600 hover:bg-green-700 text-white'}
                         `}
            >
              {isLoadingAutomationStatus ? 'Loading...' : (isAutomationActive ? 'Stop Automation' : 'Start Automation')}
            </button>
            <input
              type="number"
              value={automationInterval}
              onChange={(e) => handleIntervalChange(e.target.value)}
              disabled={isAutomationActive || isLoadingAutomationStatus}
              min="1"
              className="px-2 py-1 w-20 rounded-md border border-gray-600 bg-gray-700/80 text-white focus:ring-blue-500 focus:border-blue-500 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <span className="text-xs text-gray-300">seconds interval</span>
            {isAutomationActive && !isLoadingAutomationStatus && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Active</span>
              </div>
            )}
          </div>

          <ScreenshotQueue
            isLoading={false}
            screenshots={screenshots}
            onDeleteScreenshot={handleDeleteScreenshot}
          />
          <QueueCommands
            screenshots={screenshots}
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
          />
        </div>
      </div>
    </div>
  )
}

export default Queue
