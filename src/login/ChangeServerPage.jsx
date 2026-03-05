import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import { makeStyles } from 'tss-react/mui';
import {
  Autocomplete,
  Button,
  Container,
  createFilterOptions,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useTranslation } from '../common/components/LocalizationProvider';
import Loader from '../common/components/Loader';
import { errorsActions } from '../store';

const currentServer = `${window.location.protocol}//${window.location.host}`;

const hardcodedServers = [
  currentServer,
  'https://traccar.syriawan.mywire.org',
  'https://traccar1.syriawan.mywire.org',
  'https://traccar2.syriawan.mywire.org',
  'https://traccar3.syriawan.mywire.org',
].filter((value, index, self) => self.indexOf(value) === index);

const useStyles = makeStyles()((theme) => ({
  icon: {
    textAlign: 'center',
    fontSize: '10rem',
    color: theme.palette.neutral.main,
  },
  container: {
    textAlign: 'center',
    padding: theme.spacing(5, 3),
  },
  field: {
    margin: theme.spacing(3, 0),
  },
  buttons: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-evenly',
    '& > *': {
      flexBasis: '30%',
    },
  },
  scannerVideo: {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
  },
}));

const ChangeServerPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const attributes = useSelector((state) => state.session.server?.attributes);

  const filter = createFilterOptions();
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [inputValue, setInputValue] = useState(currentServer);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [servers, setServers] = useState(hardcodedServers);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        console.log('ChangeServerPage: checking attributes...', attributes);
        
        // Try to get from attributes (which might be filtered for public users)
        let apiUrl = attributes?.['ui.apiServiceUrl'] || attributes?.['apiServiceUrl'] || attributes?.['web.apiServiceUrl'];
        let apiKey = attributes?.['ui.apiServiceKey'] || attributes?.['apiServiceKey'] || attributes?.['web.apiServiceKey'];
        
        // Fallback to a derived URL if attributes are missing (to help debugging)
        if (!apiUrl) {
          apiUrl = `${window.location.protocol}//${window.location.hostname}:8787/servers`;
          console.log('ChangeServerPage: attributes missing, using fallback URL:', apiUrl);
        }

        console.log('ChangeServerPage: fetching from', apiUrl);

        const response = await fetch(apiUrl, {
          headers: {
            'API-Key': apiKey || '',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const fetchedServers = data.map((s) => s.address);
          setServers([...new Set([currentServer, ...fetchedServers])]);
          console.log('ChangeServerPage: servers updated:', fetchedServers);
        } else {
          console.error('ChangeServerPage: fetch failed with status', response.status, response.statusText);
        }
      } catch (e) {
        console.error('ChangeServerPage: unexpected error during fetch:', e);
      }
    };
    
    // We fetch if attributes are present OR if we have no attributes yet (to try the fallback)
    fetchServers();
  }, [attributes]);

  const validateUrl = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = (url) => {
    setLoading(true);
    if (window.webkit && window.webkit.messageHandlers.appInterface) {
      window.webkit.messageHandlers.appInterface.postMessage(`server|${url}`);
    } else if (window.appInterface) {
      window.appInterface.postMessage(`server|${url}`);
    } else {
      window.location.replace(url);
    }
  };

  const handleScanResult = (codes) => {
    if (codes && codes.length) {
      const value = codes[0].rawValue || codes[0].value || '';
      if (value) {
        setInputValue(value);
        setInvalid(!validateUrl(value));
        setScannerOpen(false);
      }
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <Container maxWidth="xs" className={classes.container}>
        <VpnLockIcon className={classes.icon} />
        <Autocomplete
          freeSolo
          className={classes.field}
          options={servers}
          renderInput={(params) => (
            <TextField {...params} label={t('settingsServer')} error={invalid} />
          )}
          value={currentServer}
          onChange={(_, value) =>
            value && validateUrl(value) ? handleSubmit(value) : setInvalid(true)
          }
          inputValue={inputValue}
          onInputChange={(_, value) => {
            setInputValue(value);
            setInvalid(false);
          }}
          filterOptions={filter}
        />
        <div className={classes.buttons}>
          <Button color="primary" variant="outlined" onClick={() => navigate(-1)}>
            {t('sharedCancel')}
          </Button>
          {Boolean(navigator?.mediaDevices?.getUserMedia) && (
            <Button color="primary" variant="outlined" onClick={() => setScannerOpen(true)}>
              {t('sharedQrCode')}
            </Button>
          )}
          <Button
            color="primary"
            variant="contained"
            onClick={() =>
              inputValue && validateUrl(inputValue) ? handleSubmit(inputValue) : setInvalid(true)
            }
            disabled={!inputValue || invalid}
          >
            {t('sharedSave')}
          </Button>
        </div>
      </Container>

      <Dialog fullWidth maxWidth="sm" open={scannerOpen} onClose={() => setScannerOpen(false)}>
        <DialogContent>
          <Scanner
            constraints={{ facingMode: 'environment' }}
            onScan={handleScanResult}
            onError={(error) => dispatch(errorsActions.push(String(error)))}
            className={classes.scannerVideo}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScannerOpen(false)}>{t('sharedCancel')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ChangeServerPage;
