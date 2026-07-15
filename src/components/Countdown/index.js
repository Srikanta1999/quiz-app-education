import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button, Popup } from 'semantic-ui-react';
import Swal from 'sweetalert2';

import { timeConverter } from '../../utils';

const Countdown = ({ countdownTime, timeOver, setTimeTaken, setTimeRemaining }) => {
  const totalTime = (countdownTime || 0) * 1000;
  const [timerTime, setTimerTime] = useState(totalTime);
  const { hours, minutes, seconds } = timeConverter(timerTime);

  useEffect(() => {
    // initialize
    setTimerTime(totalTime);
    if (typeof setTimeRemaining === 'function') {
      setTimeRemaining(Math.ceil(totalTime / 1000));
    }

    let mounted = true;
    const timer = setInterval(() => {
      setTimerTime(prev => {
        const next = prev - 1000;
        if (!mounted) return prev;

        if (typeof setTimeRemaining === 'function') {
          setTimeRemaining(Math.max(0, Math.ceil(next / 1000)));
        }

        if (next < 0) {
          clearInterval(timer);
          try {
            Swal.fire({
              icon: 'info',
              title: `Oops! Time's up.`,
              text: 'See how you did!',
              confirmButtonText: 'Check Results',
              timer: 5000,
              willClose: () => timeOver(totalTime - prev),
            });
          } catch (e) {
            timeOver(totalTime - prev);
          }
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
      if (typeof setTimeTaken === 'function') {
        setTimeTaken(totalTime - timerTime + 1000);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownTime]);

  return (
    <Button.Group size="massive" basic floated="right">
      <Popup
        content="Hours"
        trigger={<Button active>{hours}</Button>}
        position="bottom left"
      />
      <Popup
        content="Minutes"
        trigger={<Button active>{minutes}</Button>}
        position="bottom left"
      />
      <Popup
        content="Seconds"
        trigger={<Button active>{seconds}</Button>}
        position="bottom left"
      />
    </Button.Group>
  );
};

Countdown.propTypes = {
  countdownTime: PropTypes.number.isRequired,
  timeOver: PropTypes.func.isRequired,
  setTimeTaken: PropTypes.func.isRequired,
  setTimeRemaining: PropTypes.func,
};

export default Countdown;
